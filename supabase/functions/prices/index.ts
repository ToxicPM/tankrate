
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface FuelPriceEntry {
  country_code: string;
  country_name: string;
  currency: string;
  local_currency: string;
  unit: string;
  prices: {
    gasoline: number | null;
    diesel: number | null;
    lpg: number | null;
    e85: number | null;
    premium: number | null;
  };
  price_changes: {
    gasoline: number | null;
    diesel: number | null;
    lpg: number | null;
    e85: number | null;
    premium: number | null;
  };
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
  GB: "🇬🇧", US: "🇺🇸", DE: "🇩🇪", FR: "🇫🇷", IT: "🇮🇹", ES: "🇪🇸",
  NL: "🇳🇱", BE: "🇧🇪", AT: "🇦🇹", CH: "🇨🇭", PT: "🇵🇹", IE: "🇮🇪",
  SE: "🇸🇪", NO: "🇳🇴", DK: "🇩🇰", FI: "🇫🇮", PL: "🇵🇱", CZ: "🇨🇿",
  HU: "🇭🇺", RO: "🇷🇴", AU: "🇦🇺", NZ: "🇳🇿", CA: "🇨🇦", ZA: "🇿🇦",
  IN: "🇮🇳", JP: "🇯🇵", CN: "🇨🇳", KR: "🇰🇷", SG: "🇸🇬", TR: "🇹🇷",
};

const CURRENCY_MAP: Record<string, { code: string; symbol: string }> = {
  GB: { code: "GBP", symbol: "£" }, US: { code: "USD", symbol: "$" },
  DE: { code: "EUR", symbol: "€" }, FR: { code: "EUR", symbol: "€" },
  IT: { code: "EUR", symbol: "€" }, ES: { code: "EUR", symbol: "€" },
  NL: { code: "EUR", symbol: "€" }, BE: { code: "EUR", symbol: "€" },
  AT: { code: "EUR", symbol: "€" }, CH: { code: "CHF", symbol: "Fr" },
  PT: { code: "EUR", symbol: "€" }, IE: { code: "EUR", symbol: "€" },
  SE: { code: "SEK", symbol: "kr" }, NO: { code: "NOK", symbol: "kr" },
  DK: { code: "DKK", symbol: "kr" }, FI: { code: "EUR", symbol: "€" },
  PL: { code: "PLN", symbol: "zł" }, CZ: { code: "CZK", symbol: "Kč" },
  HU: { code: "HUF", symbol: "Ft" }, RO: { code: "RON", symbol: "lei" },
  AU: { code: "AUD", symbol: "A$" }, NZ: { code: "NZD", symbol: "NZ$" },
  CA: { code: "CAD", symbol: "C$" }, MX: { code: "MXN", symbol: "Mex$" },
  BR: { code: "BRL", symbol: "R$" }, AR: { code: "ARS", symbol: "AR$" },
  ZA: { code: "ZAR", symbol: "R" }, IN: { code: "INR", symbol: "₹" },
  JP: { code: "JPY", symbol: "¥" }, CN: { code: "CNY", symbol: "¥" },
  KR: { code: "KRW", symbol: "₩" }, SG: { code: "SGD", symbol: "S$" },
  TR: { code: "TRY", symbol: "₺" }, AE: { code: "AED", symbol: "د.إ" },
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

function normalizeUnit(unit: string): string {
  if (unit === "liter") return "litre";
  if (unit === "gallon") return "gallon";
  return unit;
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
  try {
    const res = await fetch("https://openvan.camp/api/currency/rates");
    if (!res.ok) throw new Error(`OpenVan currency ${res.status}`);
    const json = await res.json();
    if (json.success && json.rates) {
      const rates = json.rates as Record<string, number>;
      await supabaseFetch("/rest/v1/exchange_rates_cache", {
        method: "POST",
        body: JSON.stringify({ base: "EUR", rates }),
      });
      return rates;
    }
    throw new Error("Invalid currency response");
  } catch {
    const { data: cacheRow } = (await supabaseFetch(
      "/rest/v1/exchange_rates_cache?select=rates,updated_at&order=updated_at.desc&limit=1"
    )) as { data: { rates: Record<string, number>; updated_at: string }[] | null };
    if (cacheRow && cacheRow.length > 0) {
      const age = Date.now() - new Date(cacheRow[0].updated_at).getTime();
      if (age < 24 * 60 * 60 * 1000) return cacheRow[0].rates;
    }
    return {};
  }
}

async function fetchFromOpenVan(): Promise<Record<string, FuelPriceEntry>> {
  const res = await fetch("https://openvan.camp/api/fuel/prices");
  if (!res.ok) throw new Error(`OpenVan ${res.status}`);
  const json = await res.json();
  if (!json.success || !json.data) {
    throw new Error("Invalid OpenVan response");
  }
  return json.data as Record<string, FuelPriceEntry>;
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

async function refreshPricesCache(): Promise<Record<string, FuelPriceEntry>> {
  const allCountries = await fetchFromOpenVan();
  const rates = await getExchangeRates();

  const rows: Array<{
    country_code: string;
    fuel_type: string;
    price: number;
    currency: string;
    price_usd: number;
    unit: string;
    updated_at: string;
  }> = [];

  for (const [cc, entry] of Object.entries(allCountries)) {
    const countryCode = cc.toUpperCase();
    const curr = getCurrency(countryCode);
    const localCurrency = entry.local_currency || entry.currency || "EUR";
    const unit = normalizeUnit(entry.unit || "liter");

    const fuels: Array<{ key: string; val: number | null }> = [
      { key: "petrol", val: entry.prices.gasoline },
      { key: "diesel", val: entry.prices.diesel },
      { key: "lpg", val: entry.prices.lpg },
    ];
    if (entry.prices.e85 != null) {
      fuels.push({ key: "e85", val: entry.prices.e85 });
    }
    if (entry.prices.premium != null) {
      fuels.push({ key: "premium", val: entry.prices.premium });
    }

    for (const f of fuels) {
      if (f.val == null || isNaN(f.val)) continue;
      const localPrice = Number(f.val.toFixed(3));
      const rateToUsd = rates["USD"] ?? 1;
      const rateFromLocal = rates[localCurrency] ?? 1;
      const priceInUsd = Number((localPrice / rateFromLocal * rateToUsd).toFixed(3));
      rows.push({
        country_code: countryCode,
        fuel_type: f.key,
        price: localPrice,
        currency: localCurrency,
        price_usd: priceInUsd,
        unit,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (rows.length > 0) {
    await supabaseFetch("/rest/v1/prices_cache", {
      method: "POST",
      body: JSON.stringify(rows),
      headers: { Prefer: "resolution=merge-duplicates" },
    });
  }

  return allCountries;
}

async function buildPricePayload(
  countryCode: string
): Promise<PricePayload> {
  const cached = await getCachedPrices(countryCode);
  let apiData: Record<string, FuelPriceEntry> = {};
  let apiEntry: FuelPriceEntry | undefined;

  if (!cached) {
    apiData = await refreshPricesCache();
    apiEntry = apiData[countryCode];
  } else {
    const { data: freshData } = (await fetch("https://openvan.camp/api/fuel/prices")
      .then(r => r.json())) as { success: boolean; data: Record<string, FuelPriceEntry> };
    if (freshData && freshData.success) {
      apiData = freshData.data;
      apiEntry = apiData[countryCode];
    }
  }

  const { data: cacheRows, error } = (await supabaseFetch(
    `/rest/v1/prices_cache?select=*&country_code=eq.${countryCode}`
  )) as { data: PricesCacheRow[] | null; error: string | null };
  if (error || !cacheRows || cacheRows.length === 0) {
    if (apiEntry) {
      const curr = getCurrency(countryCode);
      const unit = normalizeUnit(apiEntry.unit || "liter");
      const prices: Record<string, { price: number; price_usd: number; unit: string }> = {};
      const weekChange: Record<string, number> = {};
      const fuelMap: Record<string, { key: string; priceKey: string }> = [
        { key: "petrol", priceKey: "gasoline" },
        { key: "diesel", priceKey: "diesel" },
        { key: "lpg", priceKey: "lpg" },
      ];
      for (const fm of fuelMap) {
        const p = apiEntry.prices[fm.priceKey];
        const c = apiEntry.price_changes[fm.priceKey];
        if (p != null) {
          prices[fm.key] = { price: Number(p.toFixed(3)), price_usd: 0, unit };
        }
        if (c != null) {
          weekChange[fm.key] = Number(c.toFixed(1));
        }
      }
      return {
        country_code: countryCode,
        country_name: apiEntry.country_name || getCountryName(countryCode),
        flag: getFlag(countryCode),
        currency: apiEntry.local_currency || curr.code,
        symbol: curr.symbol,
        updated_at: new Date().toISOString(),
        prices,
        week_change: weekChange,
      };
    }
    throw new Error("No price data available");
  }

  const countryName = apiEntry?.country_name || getCountryName(countryCode);
  const flag = getFlag(countryCode);
  const curr = getCurrency(countryCode);
  const currency = apiEntry?.local_currency || curr.code;
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

  if (apiEntry) {
    const changeMap: Record<string, string> = {
      gasoline: "petrol",
      diesel: "diesel",
      lpg: "lpg",
    };
    for (const [apiKey, fuelKey] of Object.entries(changeMap)) {
      const c = apiEntry.price_changes[apiKey as keyof typeof apiEntry.price_changes];
      if (c != null) {
        weekChange[fuelKey] = Number(c.toFixed(1));
      }
    }
  }

  return {
    country_code: countryCode,
    country_name: countryName,
    flag,
    currency,
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
