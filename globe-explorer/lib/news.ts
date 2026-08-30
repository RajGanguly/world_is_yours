export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  seenAt?: string;
}

export interface WikiSummary {
  title: string;
  extract: string;
  url: string;
}

function withTimeout(ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(id) };
}

export async function fetchRecentNews(query: string, maxRecords = 8): Promise<NewsArticle[]> {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", `"${query}"`);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("maxrecords", String(maxRecords));
  url.searchParams.set("sort", "datedesc");
  url.searchParams.set("format", "json");

  const { signal, clear } = withTimeout(6000);
  try {
    const res = await fetch(url.toString(), { signal });
    clear();
    if (!res.ok) return [];
    const data = await res.json();
    const articles = (data?.articles ?? []) as Array<Record<string, string>>;
    return articles.map((a) => ({
      title: a.title,
      url: a.url,
      source: a.domain,
      seenAt: a.seendate,
    }));
  } catch {
    clear();
    return [];
  }
}

export async function fetchWikiSummary(title: string): Promise<WikiSummary | null> {
  const { signal, clear } = withTimeout(5000);
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { signal, headers: { "User-Agent": "globe-explorer-demo/0.1" } }
    );
    clear();
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.extract) return null;
    return {
      title: data.title,
      extract: data.extract,
      url: data.content_urls?.desktop?.page ?? "",
    };
  } catch {
    clear();
    return null;
  }
}
