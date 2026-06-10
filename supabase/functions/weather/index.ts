import "jsr:@supabase/functions-js/edge-framework";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const OPENWEATHER_KEY = Deno.env.get("OPENWEATHER_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeatherResponse {
  temperature: number | null;
  description: string;
  icon: string;
  wind_speed: number | null;
  humidity: number | null;
  city: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get("lat") || "0");
  const lon = parseFloat(url.searchParams.get("lon") || "0");

  if (isNaN(lat) || isNaN(lon)) {
    return jsonResponse({ error: "lat and lon query params required" }, 400);
  }

  try {
    const weatherUrl = new URL("https://api.openweathermap.org/data/2.5/weather");
    weatherUrl.searchParams.set("lat", lat.toFixed(4));
    weatherUrl.searchParams.set("lon", lon.toFixed(4));
    weatherUrl.searchParams.set("units", "metric");
    weatherUrl.searchParams.set("appid", OPENWEATHER_KEY);

    const res = await fetch(weatherUrl.toString());
    if (!res.ok) throw new Error(`OpenWeatherMap ${res.status}`);
    const json: Record<string, unknown> = await res.json();

    const weather = json.weather as Array<{ icon: string; description: string }>;
    const main = json.main as { temp: number };
    const wind = json.wind as { speed: number };

    const payload: WeatherResponse = {
      temperature: Math.round(main.temp),
      description: weather[0].description,
      icon: weather[0].icon,
      wind_speed: wind.speed,
      humidity: main.humidity,
      city: json.name as string || "",
    };

    return jsonResponse(payload);
  } catch (err) {
    console.error("weather error:", err);
    return jsonResponse(
      {
        temperature: null,
        description: "unavailable",
        icon: "01d",
        wind_speed: null,
        humidity: null,
        city: "",
      },
      200
    );
  }
});
