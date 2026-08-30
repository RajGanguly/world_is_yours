import { LRUCache } from "lru-cache";

// Keyed by a coarse lat/lng grid cell so nearby clicks reuse the same
// lookup instead of re-hitting Nominatim/GDELT for every pixel of difference.
// This is process-memory only (resets on redeploy) — swap for Redis/Upstash
// in production so it survives across serverless invocations.
const cache = new LRUCache<string, object>({
  max: 500,
  ttl: 1000 * 60 * 15, // 15 minutes — "latest info" should actually stay fresh
});

export function gridKey(lat: number, lng: number, precision = 1): string {
  const rLat = Math.round(lat / precision) * precision;
  const rLng = Math.round(lng / precision) * precision;
  return `v2:${rLat.toFixed(1)},${rLng.toFixed(1)}`;
}

export function getCached<T extends object>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCached<T extends object>(key: string, value: T): void {
  cache.set(key, value);
}
