import Anthropic from "@anthropic-ai/sdk";
import { reverseGeocode } from "@/lib/geocode";
import {
  buildLocalNewsQuery,
  fetchCountryFacts,
  fetchCurrentWeather,
  fetchRecentNews,
  fetchWikiSummary,
} from "@/lib/news";
import { gridKey, getCached, setCached } from "@/lib/cache";

export const runtime = "nodejs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface CachedContext {
  label: string;
  isOcean: boolean;
  country?: string;
  articles: { title: string; url: string; source: string }[];
  wiki: { title: string; extract: string; url: string } | null;
  weather: { summary: string; temperatureC: number; humidity: number; windKmh: number; conditions: string } | null;
  facts: {
    country: string;
    population: number | null;
    capital: string | null;
    region: string | null;
    subregion: string | null;
    currency: string | null;
    economy: string | null;
    mapUrl: string | null;
  } | null;
}

export async function POST(req: Request) {
  const { lat, lng } = (await req.json()) as { lat: number; lng: number };

  if (typeof lat !== "number" || typeof lng !== "number") {
    return new Response(JSON.stringify({ error: "lat/lng required" }), {
      status: 400,
    });
  }

  const key = gridKey(lat, lng);
  let context = getCached<CachedContext>(key);

  if (!context) {
    const place = await reverseGeocode(lat, lng);
    const newsQuery = buildLocalNewsQuery({
      label: place.label,
      city: place.city,
      region: place.region,
      country: place.country,
    });

    const [articles, wiki, weather, facts] = await Promise.all([
      place.isOcean ? Promise.resolve([]) : fetchRecentNews(newsQuery, 8),
      fetchWikiSummary(place.city || place.region || place.label),
      fetchCurrentWeather(lat, lng),
      place.country ? fetchCountryFacts(place.country) : Promise.resolve(null),
    ]);

    context = {
      label: place.label,
      isOcean: place.isOcean,
      country: place.country,
      articles: articles.map((a) => ({ title: a.title, url: a.url, source: a.source })),
      wiki,
      weather,
      facts,
    };
    setCached(key, context);
  }

  const weatherBlock = context.weather
    ? `Current weather: ${context.weather.summary}. Temperature ${context.weather.temperatureC.toFixed(0)}°C, humidity ${context.weather.humidity}%, wind ${context.weather.windKmh.toFixed(0)} km/h.`
    : "Current weather is unavailable from free public sources right now.";

  const factsBlock = context.facts
    ? [
        context.facts.population ? `Population: ${context.facts.population.toLocaleString()}` : null,
        context.facts.capital ? `Capital: ${context.facts.capital}` : null,
        context.facts.currency ? `Currency: ${context.facts.currency}` : null,
        context.facts.region ? `Region: ${context.facts.region}${context.facts.subregion ? ` / ${context.facts.subregion}` : ""}` : null,
      ]
        .filter(Boolean)
        .join(". ")
    : "Local population and economic indicators are unavailable from the free public sources right now.";

  const sourceBlock = context.isOcean
    ? `The click landed in ${context.label}, away from any indexed landmass. ${weatherBlock} ${factsBlock}`
    : [
        context.wiki ? `Background (Wikipedia — ${context.wiki.title}): ${context.wiki.extract}` : null,
        weatherBlock,
        factsBlock,
        context.articles.length
          ? `Recent headlines:\n${context.articles
              .map((a, i) => `${i + 1}. "${a.title}" — ${a.source}`)
              .join("\n")}`
          : "No recent local news was returned from public feeds for this specific area.",
      ]
        .filter(Boolean)
        .join("\n\n");

  const systemPrompt = `You are the narration layer for an interactive globe app called World is Yours. \
The user clicked a point on Earth at latitude ${lat.toFixed(2)}, longitude ${lng.toFixed(2)}, \
identified as: ${context.label}. This should feel like a city brief that combines local news, weather, nearby places, and general economic or civic context when available.

Using ONLY the source material provided below, write a concise briefing (120-180 words) covering what's currently notable or newsworthy about this location. If the sources are thin, say so plainly, and mention the local environment, weather, nearby attractions, and any visible economic or civic signals that are reasonable from the available material. Do not invent specific events, statistics, or news that is not grounded in the sources. Write in short, scannable paragraphs. No headers, no markdown bullets, plain prose only.

SOURCE MATERIAL:
${sourceBlock}`;

  const stream = await anthropic.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: "user", content: "Give me the briefing for this location." }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      stream.on("text", (chunk) => {
        controller.enqueue(encoder.encode(chunk));
      });
      stream.on("end", () => {
        const meta = JSON.stringify({
          __meta: true,
          label: context!.label,
          country: context!.country,
          isOcean: context!.isOcean,
          sources: context!.articles.slice(0, 5),
          wikiUrl: context!.wiki?.url ?? null,
          facts: context!.facts,
          weather: context!.weather,
        });
        controller.enqueue(encoder.encode(`\n\n@@META@@${meta}`));
        controller.close();
      });
      stream.on("error", (err) => {
        controller.error(err);
      });
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
