
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HistoryRow {
  recorded_date: string;
  price: number;
  currency: string;
}

async function supabaseFetch(
  path: string,
  options: Record<string, unknown> = {}
): Promise<{ data: unknown; error: string | null }> {
  try {
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
  } catch (err) {
    return { data: null, error: `Network: ${err}` };
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const country = (url.searchParams.get("country") || "GB").toUpperCase();
  const fuel = url.searchParams.get("fuel") || "petrol";
  const days = parseInt(url.searchParams.get("days") || "30", 10);

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const { data, error } = (await supabaseFetch(
      `/rest/v1/price_history?select=recorded_date,price,currency,fuel_type&country_code=eq.${country}&recorded_date=gte.${cutoffStr}&order=recorded_date.asc`
    )) as { data: HistoryRow[] | null; error: string | null };

    if (error || !data || data.length === 0) {
      return jsonResponse({
        error: "No history data available",
        fallback: [],
      }, 200);
    }

    return jsonResponse(
      data.map((r) => ({
        date: r.recorded_date,
        price: r.price,
        currency: r.currency,
        fuel_type: r.fuel_type,
      }))
    );
  } catch (err) {
    console.error("history error:", err);
    return jsonResponse({ error: String(err), fallback: [] }, 500);
  }
});
