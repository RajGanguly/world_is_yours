# World is Yours — click-anywhere globe explorer

A Next.js app: click any point on a 3D globe, get a live-sourced briefing on
that location, streamed from Claude and grounded in real-time news + Wikipedia
context (not the model's memory).

## Quick start

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000, drag/click the globe.

## How it works

```
click on globe (lat/lng)
        │
        ▼
app/api/location-info/route.ts
        │
        ├─ lib/geocode.ts    → Nominatim reverse geocode (lat/lng → place name)
        ├─ lib/news.ts       → GDELT recent articles + Wikipedia summary
        ├─ lib/cache.ts      → 15-min in-memory cache, keyed by 1° grid cell
        │
        ▼
Claude (claude-sonnet-5), system prompt = fetched sources only
        │
        ▼
streamed plain-text response + trailing @@META@@{json} block
        │
        ▼
components/InfoPanel.tsx renders progressively, then shows source chips
```

### Why this isn't classic RAG

The brief mentioned a RAG pipeline, but "latest info about wherever you
click" is fundamentally a **live retrieval** problem, not a semantic-search-
over-static-corpus problem — there's nothing pre-indexed to embed and search,
because the whole point is freshness. So this scaffold fetches small, live
result sets (a handful of news articles + one Wikipedia summary) and stuffs
them directly into the Claude context window. That's simpler and just as
accurate at this scale.

If you want to add real RAG on top, the natural place is a **static
knowledge layer** that's worth pre-indexing once — e.g. country/region
almanac data, historical background, longer-form encyclopedic content — in
a vector DB (pgvector, Pinecone, Weaviate). Query it alongside the live
fetch and merge both into the system prompt.

## Known gaps to fill in before shipping

- **Nominatim usage policy**: free tier is rate-limited (~1 req/sec) and
  requires a real contact email in the User-Agent header (`lib/geocode.ts`).
  For real traffic, either self-host Nominatim or switch to a paid geocoder
  (Google, Mapbox, LocationIQ).
- **Cache is process-memory only** (`lib/cache.ts`) — fine for local dev,
  but resets on every serverless cold start / redeploy. Swap the
  `LRUCache` for Upstash Redis (or similar) once this is deployed.
- **Ocean clicks**: currently a coarse bounding-box guess at which ocean
  basin was hit (`lib/geocode.ts`). Good enough for a demo; a proper
  land/water polygon lookup (e.g. Natural Earth data) would be more precise.
- **GDELT query quality**: it's a blunt keyword search against the city
  name. For sparser locations you'll often get zero articles back — the
  prompt is written to admit that honestly rather than fabricate news, but
  you may want to broaden the query (try region, then country) as a fallback
  chain.
- **No auth/rate limiting** on the API route — add before deploying publicly,
  since each click costs an LLM call plus a few external fetches.

## Stack

- **Next.js 14** (App Router)
- **react-globe.gl** for the WebGL globe + click→lat/lng
- **Tailwind CSS** for styling (custom token set in `tailwind.config.ts`,
  not a component library — Aceternity's effects are copy-paste React/Tailwind
  snippets, not an installable package, so the info panel here is built from
  scratch in the same spirit; drop in any Aceternity component you like)
- **Framer Motion** for the panel's slide-in
- **@anthropic-ai/sdk** for streaming completions
- **lru-cache** for the in-memory cache layer

## A note on Aceternity UI

Aceternity isn't an npm package — it's a library of copy-pasteable
components (from https://ui.aceternity.com) built on Tailwind + Framer
Motion + `clsx`/`tailwind-merge`. `InfoPanel.tsx` is written in that same
style, so if you want a specific Aceternity effect (e.g. `Sparkles`,
`BackgroundBeams`, `CardHoverEffect`), copy the component source from their
site into `components/ui/` and drop it into `InfoPanel.tsx` or `page.tsx`
directly.
