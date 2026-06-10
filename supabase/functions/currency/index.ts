import "jsr:@supabase/functions-js/edge-framework";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const EXCHANGE_API_URL = "https://open.exchangerate-api.com/v6/latest/USD";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExchangeRatePayload {
  base: string;
  rates: Record<string, number>;
  updated_at: string;
  source: "cache" | "api";
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}

async function supabaseFetch(
  path: string,
  options: Record<string, unknown> = {}
): Promise<{ data: unknown; error: string | null }> {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) return { data: null, error: `Supabase ${res.status}` };
  const data = await res.json();
  return { data: data.data ?? data, error: null };
}

async function getCachedRates(): Promise<ExchangeRatePayload | null> {
  const { data, error } = (await supabaseFetch(
    "/rest/v1/exchange_rates_cache?select=*&order=updated_at.desc&limit=1"
  )) as { data: ExchangeRatePayload[] | null; error: string | null };
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  const age = Date.now() - new Date(row.updated_at).getTime();
  if (age >= 24 * 60 * 60 * 1000) return null;
  return { ...row, source: "cache" as const };
}

async function fetchAndStoreRates(): Promise<ExchangeRatePayload> {
  const res = await fetch(EXCHANGE_API_URL);
  if (!res.ok) throw new Error(`ExchangeRate-API ${res.status}`);
  const json = await res.json();
  const rates = json.rates as Record<string, number>;

  await supabaseFetch("/rest/v1/exchange_rates_cache", {
    method: "POST",
    body: JSON.stringify({
      base: "USD",
      rates,
      updated_at: new Date().toISOString(),
    }),
  });

  return {
    base: "USD",
    rates,
    updated_at: new Date().toISOString(),
    source: "api" as const,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const cached = await getCachedRates();
    if (cached) return jsonResponse(cached);
    const fresh = await fetchAndStoreRates();
    return jsonResponse(fresh);
  } catch (err) {
    console.error("currency error:", err);
    const cached = await getCachedRates();
    if (cached) return jsonResponse(cached);
    return jsonResponse(
      { error: "Currency rates unavailable", rates: {}, base: "USD" },
      500
    );
  }
});
