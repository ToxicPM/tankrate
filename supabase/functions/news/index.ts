import "jsr:@supabase/functions-js/edge-framework";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const NEWSAPI_KEY = Deno.env.get("NEWSAPI_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NewsArticle {
  title: string;
  url: string;
  source: string;
  description: string;
  image_url: string | null;
  published_at: string;
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
      "Cache-Control": "public, max-age=7200",
    },
  });
}

async function fetchFromNewsAPI(countryCode?: string): Promise<NewsArticle[]> {
  const queries = [
    "petrol prices",
    "diesel prices",
    "fuel prices",
    countryCode ? `fuel prices ${countryCode}` : "",
  ].filter(Boolean);

  const q = queries.slice(0, 3).join(" OR ");
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", q);
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "12");

  const res = await fetch(url.toString(), {
    headers: { "X-Api-Key": NEWSAPI_KEY },
  });
  if (!res.ok) throw new Error(`NewsAPI ${res.status}`);
  const json = await res.json();
  const articles = (json.articles ?? []) as Array<{
    title: string;
    url: string;
    source: { name: string };
    description: string;
    urlToImage: string | null;
    publishedAt: string;
  }>;

  const mapped: NewsArticle[] = articles.slice(0, 6).map((a) => ({
    title: a.title,
    url: a.url,
    source: a.source?.name ?? "News",
    description: a.description ?? "",
    image_url: a.urlToImage ?? null,
    published_at: a.publishedAt,
  }));
  return mapped;
}

async function refreshNewsCache(): Promise<NewsArticle[]> {
  const articles = await fetchFromNewsAPI();
  const rows = articles.map((a) => ({
    title: a.title,
    url: a.url,
    source: a.source,
    description: a.description,
    image_url: a.image_url,
    published_at: a.published_at,
    fetched_at: new Date().toISOString(),
  }));
  await supabaseFetch("/rest/v1/news_cache", {
    method: "POST",
    body: JSON.stringify(rows),
  });
  return articles;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const forceRefresh = url.searchParams.get("refresh") === "true";

  try {
    if (forceRefresh) {
      await refreshNewsCache();
    }

    const { data: cached, error } = (await supabaseFetch(
      "/rest/v1/news_cache?select=*&order=fetched_at.desc&limit=1"
    )) as {
      data: { fetched_at: string }[] | null;
      error: string | null;
    };

    if (cached && !error && cached.length > 0) {
      const age = Date.now() - new Date(cached[0].fetched_at).getTime();
      if (age < 2 * 60 * 60 * 1000) {
        const allNews = (await supabaseFetch(
          "/rest/v1/news_cache?select=*&order=published_at.desc&limit=6"
        )) as { data: NewsArticle[] | null; error: string | null };
        const newsData = allNews.data ?? [];
        if (newsData.length > 0) {
          return jsonResponse(newsData);
        }
      }
    }

    const articles = await refreshNewsCache();
    return jsonResponse(articles);
  } catch (err) {
    console.error("news error:", err);
    const { data: fallback } = (await supabaseFetch(
      "/rest/v1/news_cache?select=*&order=fetched_at.desc&limit=6"
    )) as { data: NewsArticle[] | null; error: string | null };
    return jsonResponse(fallback ?? [], 200);
  }
});
