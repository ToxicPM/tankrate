import "jsr:@supabase/functions-js/edge-framework";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COLLECTAPI_KEY = Deno.env.get("COLLECTAPI_KEY")!;

interface FuelPrice {
  country: string;
  countrycode: string;
  gasoline: number;
  gasoline_e5?: number;
  gasoline_e10?: number;
  diesel: number;
  lpg: number;
}

interface CountryStatsRow {
  country_code: string;
  country_name: string;
  flag_emoji: string;
  currency_code: string;
  currency_symbol: string;
  unit_default: string;
}

interface PricesCacheRow {
  country_code: string;
  fuel_type: string;
  price: number;
  currency: string;
  price_usd: number;
  unit: string;
  updated_at: string;
}

interface PricePayload {
  country_code: string;
  country_name: string;
  flag: string;
  currency: string;
  symbol: string;
  updated_at: string;
  prices: Record<string, { price: number; price_usd: number; unit: string }>;
  week_change: Record<string, number>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const COUNTRY_NAME_MAP: Record<string, string> = {
  GB: "United Kingdom",
  US: "United States",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  ES: "Spain",
  NL: "Netherlands",
  BE: "Belgium",
  AT: "Austria",
  CH: "Switzerland",
  PT: "Portugal",
  IE: "Ireland",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  PL: "Poland",
  CZ: "Czech Republic",
  HU: "Hungary",
  RO: "Romania",
  BG: "Bulgaria",
  HR: "Croatia",
  SK: "Slovakia",
  SI: "Slovenia",
  GR: "Greece",
  TR: "Turkey",
  RU: "Russia",
  UA: "Ukraine",
  AU: "Australia",
  NZ: "New Zealand",
  CA: "Canada",
  MX: "Mexico",
  BR: "Brazil",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  ZA: "South Africa",
  IN: "India",
  JP: "Japan",
  CN: "China",
  KR: "South Korea",
  SG: "Singapore",
  MY: "Malaysia",
  TH: "Thailand",
  ID: "Indonesia",
  PH: "Philippines",
  VN: "Vietnam",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  IL: "Israel",
};

const FLAG_EMOJI_MAP: Record<string, string> = {
  GB: "🇬🇧",
  US: "🇺🇸",
  DE: "🇩🇪",
  FR: "🇫🇷",
  IT: "🇮🇹",
  ES: "🇪🇸",
  NL: "🇳🇱",
  BE: "🇧🇪",
  AT: "🇦🇹",
  CH: "🇨🇭",
  PT: "🇵🇹",
  IE: "🇮🇪",
  SE: "🇸🇪",
  NO: "🇳🇴",
  DK: "🇩🇰",
  FI: "🇫🇮",
  PL: "🇵🇱",
  CZ: "🇨🇿",
  HU: "🇭🇺",
  RO: "🇷🇴",
  AU: "🇦🇺",
  NZ: "🇳🇿",
  CA: "🇨🇦",
  MX: "🇲🇽",
  BR: "🇧🇷",
  AR: "🇦🇷",
  ZA: "🇿🇦",
  IN: "🇮🇳",
  JP: "🇯🇵",
  CN: "🇨🇳",
  KR: "🇰🇷",
  SG: "🇸🇬",
  TR: "🇹🇷",
};

const CURRENCY_MAP: Record<string, { code: string; symbol: string }> = {
  GB: { code: "GBP", symbol: "£" },
  US: { code: "USD", symbol: "$" },
  DE: { code: "EUR", symbol: "€" },
  FR: { code: "EUR", symbol: "€" },
  IT: { code: "EUR", symbol: "€" },
  ES: { code: "EUR", symbol: "€" },
  NL: { code: "EUR", symbol: "€" },
  BE: { code: "EUR", symbol: "€" },
  AT: { code: "EUR", symbol: "€" },
  CH: { code: "CHF", symbol: "Fr" },
  PT: { code: "EUR", symbol: "€" },
  IE: { code: "EUR", symbol: "€" },
  SE: { code: "SEK", symbol: "kr" },
  NO: { code: "NOK", symbol: "kr" },
  DK: { code: "DKK", symbol: "kr" },
  FI: { code: "EUR", symbol: "€" },
  PL: { code: "PLN", symbol: "zł" },
  CZ: { code: "CZK", symbol: "Kč" },
  HU: { code: "HUF", symbol: "Ft" },
  RO: { code: "RON", symbol: "lei" },
  AU: { code: "AUD", symbol: "A$" },
  NZ: { code: "NZD", symbol: "NZ$" },
  CA: { code: "CAD", symbol: "C$" },
  MX: { code: "MXN", symbol: "Mex$" },
  BR: { code: "BRL", symbol: "R$" },
  AR: { code: "ARS", symbol: "AR$" },
  ZA: { code: "ZAR", symbol: "R" },
  IN: { code: "INR", symbol: "₹" },
  JP: { code: "JPY", symbol: "¥" },
  CN: { code: "CNY", symbol: "¥" },
  KR: { code: "KRW", symbol: "₩" },
  SG: { code: "SGD", symbol: "S$" },
  TR: { code: "TRY", symbol: "₺" },
  AE: { code: "AED", symbol: "د.إ" },
};

function getFlag(code: string): string {
  return FLAG_EMOJI_MAP[code] || code.toUpperCase();
}

function getCurrency(code: string): { code: string; symbol: string } {
  return CURRENCY_MAP[code] || { code: "USD", symbol: "$" };
}

function getCountryName(code: string): string {
  return COUNTRY_NAME_MAP[code] || code;
}

function isoCodeToCountryCode(iso: string): string {
  return iso.toUpperCase();
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
    if (!res.ok) {
      return { data: null, error: `Supabase error: ${res.status}` };
    }
    const data = await res.json();
    return { data: data.data ?? data, error: null };
  } catch (err) {
    return { data: null, error: `Network error: ${err}` };
  }
}

async function getExchangeRates(): Promise<Record<string, number>> {
  const { data: cacheRow, error } = (await supabaseFetch(
    "/rest/v1/exchange_rates_cache?select=rates,updated_at&order=updated_at.desc&limit=1"
  )) as {
    data: { rates: Record<string, number>; updated_at: string }[] | null;
    error: string | null;
  };
  if (cacheRow && !error && cacheRow.length > 0) {
    const row = cacheRow[0];
    const age = Date.now() - new Date(row.updated_at).getTime();
    if (age < 24 * 60 * 60 * 1000) {
      return row.rates;
    }
  }
  try {
    const res = await fetch(
      "https://open.exchangerate-api.com/v6/latest/USD"
    );
    if (!res.ok) throw new Error(`ExchangeRate API ${res.status}`);
    const json = await res.json();
    const rates = json.rates as Record<string, number>;
    await supabaseFetch("/rest/v1/exchange_rates_cache", {
      method: "POST",
      body: JSON.stringify({ base: "USD", rates }),
    });
    return rates;
  } catch {
    if (cacheRow && cacheRow.length > 0) return cacheRow[0].rates;
    return {};
  }
}

async function fetchFromCollectAPI(): Promise<FuelPrice[]> {
  const res = await fetch(
    "https://api.collectapi.com/gasPrice/allCountries",
    {
      headers: { authorization: `apikey ${COLLECTAPI_KEY}` },
    }
  );
  if (!res.ok) throw new Error(`CollectAPI ${res.status}`);
  const json = await res.json();
  return json.result ?? [];
}

async function getCachedPrices(
  countryCode: string
): Promise<PricesCacheRow[] | null> {
  const { data, error } = (await supabaseFetch(
    `/rest/v1/prices_cache?select=*&country_code=eq.${countryCode}`
  )) as { data: PricesCacheRow[] | null; error: string | null };
  if (error || !data || data.length === 0) return null;
  const age = Date.now() - new Date(data[0].updated_at).getTime();
  if (age >= 6 * 60 * 60 * 1000) return null;
  return data;
}

async function refreshPricesCache(): Promise<FuelPrice[]> {
  const prices = await fetchFromCollectAPI();
  const rates = await getExchangeRates();
  const usdRate = rates["USD"] ?? 1;

  const rows: Record<
    string,
    {
      country_code: string;
      fuel_type: string;
      price: number;
      currency: string;
      price_usd: number;
      unit: string;
      updated_at: string;
    }
  > = {};

  for (const p of prices) {
    const cc = isoCodeToCountryCode(p.countrycode);
    const curr = getCurrency(cc);
    const unit = cc === "US" ? "gallon" : "litre";
    const multiplier = cc === "US" ? 3.78541 : 1;

    const fuels: Array<{ key: string; val: number }> = [
      { key: "petrol", val: p.gasoline },
      { key: "diesel", val: p.diesel },
      { key: "lpg", val: p.lpg },
    ];
    if (p.gasoline_e10 != null) {
      fuels.push({ key: "petrol_e10", val: p.gasoline_e10 });
    }

    for (const f of fuels) {
      if (f.val == null || isNaN(f.val)) continue;
      const localPrice = Number((f.val * multiplier).toFixed(3));
      const priceInUsd = Number(
        (localPrice / (curr.code === "USD" ? 1 : rates[curr.code] ?? usdRate)).toFixed(3)
      );
      const rowKey = `${cc}:${f.key}`;
      rows[rowKey] = {
        country_code: cc,
        fuel_type: f.key,
        price: localPrice,
        currency: curr.code,
        price_usd: priceInUsd,
        unit,
        updated_at: new Date().toISOString(),
      };
    }
  }

  const insertRows = Object.values(rows);
  if (insertRows.length > 0) {
    await supabaseFetch("/rest/v1/prices_cache", {
      method: "POST",
      body: JSON.stringify(insertRows),
      headers: { Prefer: "resolution=merge-duplicates" },
    });
  }

  return prices;
}

async function buildPricePayload(
  countryCode: string
): Promise<PricePayload> {
  const cached = await getCachedPrices(countryCode);
  let apiPrices: FuelPrice[] = [];
  if (!cached) {
    apiPrices = await refreshPricesCache();
  }

  const { data: cacheRows, error } = (await supabaseFetch(
    `/rest/v1/prices_cache?select=*&country_code=eq.${countryCode}`
  )) as { data: PricesCacheRow[] | null; error: string | null };
  if (error || !cacheRows || cacheRows.length === 0) {
    throw new Error("No price data available");
  }

  const countryName = getCountryName(countryCode);
  const flag = getFlag(countryCode);
  const curr = getCurrency(countryCode);
  const latestUpdatedAt = cacheRows.reduce(
    (max, r) => (r.updated_at > max ? r.updated_at : max),
    cacheRows[0].updated_at
  );

  const prices: Record<string, { price: number; price_usd: number; unit: string }> = {};
  const weekChange: Record<string, number> = {};

  for (const r of cacheRows) {
    if (["petrol", "diesel", "lpg"].includes(r.fuel_type)) {
      prices[r.fuel_type] = {
        price: r.price,
        price_usd: r.price_usd,
        unit: r.unit,
      };
      weekChange[r.fuel_type] = 0;
    }
  }

  if (apiPrices.length > 0) {
    const target = apiPrices.find(
      (p) => isoCodeToCountryCode(p.countrycode) === countryCode
    );
    if (target) {
      const prevRow = await supabaseFetch(
        `/rest/v1/price_history?select=fuel_type,price&country_code=eq.${countryCode}&recorded_date=lt.now()-7&order=recorded_date.desc&limit=3`
      );
      const prev = (prevRow.data as { fuel_type: string; price: number }[] | null) ?? [];
      const prevMap = new Map(prev.map((p) => [p.fuel_type, p.price]));
      if (target.gasoline != null && prevMap.has("petrol")) {
        weekChange["petrol"] = Number(
          (target.gasoline - prevMap.get("petrol")!).toFixed(1)
        );
      }
      if (target.diesel != null && prevMap.has("diesel")) {
        weekChange["diesel"] = Number(
          (target.diesel - prevMap.get("diesel")!).toFixed(1)
        );
      }
      if (target.lpg != null && prevMap.has("lpg")) {
        weekChange["lpg"] = Number(
          (target.lpg - prevMap.get("lpg")!).toFixed(1)
        );
      }
    }
  }

  return {
    country_code: countryCode,
    country_name: countryName,
    flag,
    currency: curr.code,
    symbol: curr.symbol,
    updated_at: latestUpdatedAt,
    prices,
    week_change: weekChange,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=21600",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const country = (url.searchParams.get("country") || "GB").toUpperCase();
  const forceRefresh = url.searchParams.get("refresh") === "true";

  try {
    if (forceRefresh) {
      await refreshPricesCache();
    }

    const payload = await buildPricePayload(country);
    return jsonResponse(payload);
  } catch (err) {
    console.error("prices error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
