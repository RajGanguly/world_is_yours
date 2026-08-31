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

export interface WeatherSnapshot {
  temperatureC: number;
  humidity: number;
  windKmh: number;
  conditions: string;
  summary: string;
}

export interface CountryFacts {
  country: string;
  population: number | null;
  capital: string | null;
  region: string | null;
  subregion: string | null;
  currency: string | null;
  economy: string | null;
  mapUrl: string | null;
}

function withTimeout(ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(id) };
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}

export function buildLocalNewsQuery(input: { label?: string; city?: string; region?: string; country?: string }): string {
  const parts = [input.city, input.region, input.country, input.label]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim())
    .filter((value) => !/lat|lng|longitude|latitude/i.test(value));

  const normalized = parts
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter((value, index, array) => value && array.indexOf(value) === index)
    .slice(0, 4);

  return normalized.length ? `${normalized.join(" ")} latest news` : "local news";
}

export async function fetchRecentNews(query: string, maxRecords = 8): Promise<NewsArticle[]> {
  const cleanQuery = query.trim() || "local news";
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(cleanQuery)}&hl=en-US&gl=US&ceid=US:en`;

  const { signal, clear } = withTimeout(9000);

  try {
    const res = await fetch(url, { signal, headers: { "User-Agent": "Mozilla/5.0" } });
    clear();
    if (!res.ok) return [];

    const xml = await res.text();
    const itemBlocks = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((match) => match[0]);
    const articles: NewsArticle[] = [];

    for (const block of itemBlocks) {
      const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i) || block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);

      const title = decodeHtml((titleMatch?.[1] ?? "").trim());
      const url = decodeHtml((linkMatch?.[1] ?? "").trim());
      const source = decodeHtml((sourceMatch?.[1] ?? "").trim()) || new URL(url).hostname.replace(/^www\./, "");

      if (!title || !url) continue;

      articles.push({ title, url, source, seenAt: new Date().toISOString() });
      if (articles.length >= maxRecords) break;
    }

    return articles;
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

export async function fetchCurrentWeather(lat: number, lng: number): Promise<WeatherSnapshot | null> {
  const { signal, clear } = withTimeout(8000);

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto&forecast_days=1`;
    const res = await fetch(url, { signal });
    clear();
    if (!res.ok) return null;

    const data = await res.json();
    const current = data.current;
    if (!current) return null;

    const weatherCode = Number(current.weather_code ?? 0);
    const conditions = getWeatherLabel(weatherCode);
    const temperatureC = Number(current.temperature_2m ?? 0);
    const humidity = Number(current.relative_humidity_2m ?? 0);
    const windKmh = Number(current.wind_speed_10m ?? 0);

    return {
      temperatureC,
      humidity,
      windKmh,
      conditions,
      summary: `${conditions}, ${temperatureC.toFixed(0)}°C, humidity ${humidity}%`,
    };
  } catch {
    clear();
    return null;
  }
}

export async function fetchCountryFacts(countryName: string): Promise<CountryFacts | null> {
  const cleanCountry = countryName?.trim();
  if (!cleanCountry) return null;

  const { signal, clear } = withTimeout(8000);

  try {
    const res = await fetch(
      `https://restcountries.com/v3.1/name/${encodeURIComponent(cleanCountry)}?fields=name,population,capital,region,subregion,currencies,maps`,
      { signal }
    );
    clear();
    if (!res.ok) return null;

    const data = await res.json();
    const match = Array.isArray(data) ? data[0] : null;
    if (!match) return null;

    const currencies = Object.values((match.currencies ?? {}) as Record<string, { name?: string; symbol?: string }> ?? {});
    const currency = currencies
      .map((currencyInfo) => currencyInfo?.name ?? currencyInfo?.symbol)
      .filter(Boolean)
      .join(", ") || null;

    const region = match.region ?? null;
    const subregion = match.subregion ?? null;
    const population = typeof match.population === "number" ? match.population : null;
    const capital = Array.isArray(match.capital) ? match.capital[0] ?? null : null;
    const country = match.name?.common ?? cleanCountry;

    return {
      country,
      population,
      capital,
      region,
      subregion,
      currency,
      economy: [region, subregion].filter(Boolean).join(" • ") || null,
      mapUrl: match.maps?.googleMaps ?? match.maps?.openStreetMaps ?? null,
    };
  } catch {
    clear();
    return null;
  }
}

function getWeatherLabel(code: number): string {
  const mapping: Record<number, string> = {
    0: "Clear sky",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Cloudy",
    45: "Foggy",
    48: "Depositing fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    56: "Freezing drizzle",
    57: "Heavy freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Rain showers",
    81: "Heavy rain showers",
    82: "Violent rain showers",
    85: "Light snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe thunderstorm",
  };

  return mapping[code] ?? "Conditions available";
}
