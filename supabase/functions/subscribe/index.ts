
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubscribePayload {
  email: string;
  country_code: string;
  fuel_types: string[];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json()) as SubscribePayload;
    const { email, country_code, fuel_types } = body;

    if (!email || !isValidEmail(email)) {
      return jsonResponse({ error: "Valid email is required" }, 400);
    }
    if (!country_code || country_code.length !== 2) {
      return jsonResponse({ error: "Valid country_code is required" }, 400);
    }
    if (!Array.isArray(fuel_types) || fuel_types.length === 0) {
      return jsonResponse(
        { error: "At least one fuel_type is required" },
        400
      );
    }

    const upperFuel = fuel_types.map((f) =>
      f.toLowerCase().replace(/\s+/g, "_")
    );
    const validFuels = upperFuel.filter((f) =>
      ["petrol", "diesel", "lpg"].includes(f)
    );
    if (validFuels.length === 0) {
      return jsonResponse(
        { error: "fuel_types must include petrol, diesel, or lpg" },
        400
      );
    }

    const countryCodeUpper = country_code.toUpperCase();

    const { data: existing, error: checkError } = (await supabaseFetch(
      `/rest/v1/subscribers?select=id&email=eq.${encodeURIComponent(email.toLowerCase())}`
    )) as { data: { id: string }[] | null; error: string | null };

    if (existing && existing.length > 0) {
      return jsonResponse(
        { error: "This email is already subscribed." },
        409
      );
    }

    const { data, error } = (await supabaseFetch(
      "/rest/v1/subscribers",
      {
        method: "POST",
        body: JSON.stringify({
          email: email.toLowerCase(),
          country_code: countryCodeUpper,
          fuel_types: validFuels,
          confirmed: false,
          created_at: new Date().toISOString(),
        }),
      }
    )) as { data: SubscribePayload | null; error: string | null };

    if (error) {
      return jsonResponse({ error: `Database error: ${error}` }, 500);
    }

    return jsonResponse({
      success: true,
      message:
        "You're subscribed! Check your email to confirm. If you don't see it, check your spam folder.",
    });
  } catch (err) {
    console.error("subscribe error:", err);
    return jsonResponse({ error: "Invalid request body" }, 400);
  }
});
