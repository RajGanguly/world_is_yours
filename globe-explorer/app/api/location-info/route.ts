import Anthropic from "@anthropic-ai/sdk";
import { reverseGeocode } from "@/lib/geocode";
import { fetchRecentNews, fetchWikiSummary } from "@/lib/news";
import { gridKey, getCached, setCached } from "@/lib/cache";

export const runtime = "nodejs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface CachedContext {
  label: string;
  isOcean: boolean;
  country?: string;
  articles: { title: string; url: string; source: string }[];
  wiki: { title: string; extract: string; url: string } | null;
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
  console.log("Cache lookup:", {
    key,
    hit: Boolean(context),
    context: context ? JSON.stringify(context, null, 2) : "<cache miss>",
  });

  if (!context) {
    const place = await reverseGeocode(lat, lng);

    console.log("Reverse-geocoded place:", JSON.stringify(place, null, 2));
    const [articles, wiki] = await Promise.all([
      place.isOcean ? Promise.resolve([]) : fetchRecentNews(place.city || place.label, 8),
      fetchWikiSummary(place.city || place.region || place.label),
    ]);

    context = {
      label: place.label,
      isOcean: place.isOcean,
      country: place.country,
      articles: articles.map((a) => ({ title: a.title, url: a.url, source: a.source })),
      wiki,
    };
    setCached(key, context);
  }

  const sourceBlock = context.isOcean
    ? `The click landed in ${context.label}, away from any indexed landmass.`
    : [
        context.wiki ? `Background (Wikipedia — ${context.wiki.title}): ${context.wiki.extract}` : null,
        context.articles.length
          ? `Recent headlines:\n${context.articles
              .map((a, i) => `${i + 1}. "${a.title}" — ${a.source}`)
              .join("\n")}`
          : "No recent indexed news articles were found for this specific area.",
      ]
        .filter(Boolean)
        .join("\n\n");

  const systemPrompt = `You are the narration layer for an interactive globe app called Groundtruth. \
The user clicked a point on Earth at latitude ${lat.toFixed(2)}, longitude ${lng.toFixed(2)}, \
identified as: ${context.label}.

Using ONLY the source material provided below, write a concise briefing (120-180 words) covering \
what's currently notable or newsworthy about this location. If the sources are thin or this is open \
ocean, say so plainly and share whatever relevant geographic/oceanic context is reasonable — do not \
invent specific events, statistics, or news that isn't grounded in the sources. Write in short, \
scannable paragraphs. No headers, no markdown bullets — plain prose only.

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
        // Trailing metadata block the client parses out to render source chips.
        const meta = JSON.stringify({
          __meta: true,
          label: context!.label,
          country: context!.country,
          isOcean: context!.isOcean,
          sources: context!.articles.slice(0, 5),
          wikiUrl: context!.wiki?.url ?? null,
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
