export interface PlaceInfo {
  label: string; // human-friendly display name, e.g. "Kyoto, Japan"
  city?: string;
  region?: string;
  country?: string;
  isOcean: boolean;
  raw?: unknown;
}

const OCEAN_LOOKUP = [
  { name: "North Pacific Ocean", latMin: 0, latMax: 60, lngMin: 130, lngMax: 180 },
  { name: "South Pacific Ocean", latMin: -60, latMax: 0, lngMin: -180, lngMax: -70 },
  { name: "North Atlantic Ocean", latMin: 0, latMax: 60, lngMin: -70, lngMax: -10 },
  { name: "South Atlantic Ocean", latMin: -60, latMax: 0, lngMin: -50, lngMax: 10 },
  { name: "Indian Ocean", latMin: -60, latMax: 20, lngMin: 40, lngMax: 100 },
  { name: "Arctic Ocean", latMin: 66, latMax: 90, lngMin: -180, lngMax: 180 },
  { name: "Southern Ocean", latMin: -90, latMax: -60, lngMin: -180, lngMax: 180 },
];

function guessOceanName(lat: number, lng: number): string | null {
  const hit = OCEAN_LOOKUP.find(
    (o) => lat >= o.latMin && lat <= o.latMax && lng >= o.lngMin && lng <= o.lngMax
  );
  return hit?.name ?? null;
}

function unavailablePlace(lat: number, lng: number): PlaceInfo {
  const oceanName = guessOceanName(lat, lng);
  return {
    label: oceanName ?? `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
    isOcean: Boolean(oceanName),
  };
}

/**
 * Reverse-geocodes a lat/lng using OpenStreetMap's Nominatim (free, no key,
 * but rate-limited — respect the 1 req/sec policy and cache results).
 * Falls back to a rough ocean-basin guess when there's no land address.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<PlaceInfo> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", "10"); // country/region level, useful for rural land
  url.searchParams.set("accept-language", "en");
  const email = process.env.NOMINATIM_EMAIL;
  if (email) url.searchParams.set("email", email);

  const res = await fetch(url.toString(), {
    headers: {
      // Nominatim usage policy requires a descriptive UA with contact info.
      "User-Agent": `globe-explorer/0.1${email ? ` (${email})` : ""}`,
    },
  });

  if (!res.ok) {
    console.error(`Nominatim reverse geocoding failed: ${res.status} ${res.statusText}`);
    return unavailablePlace(lat, lng);
  }

  const data = await res.json();

  if (!data || data.error || !data.address) {
    return unavailablePlace(lat, lng);
  }

  const addr = data.address as Record<string, string>;
  const city = addr.city || addr.town || addr.village || addr.county;
  const region = addr.state || addr.region;
  const country = addr.country;

  const label = [city, region && region !== city ? region : null, country]
    .filter(Boolean)
    .join(", ") || (data.display_name as string) || `${lat.toFixed(2)}, ${lng.toFixed(2)}`;

  return {
    label,
    city,
    region,
    country,
    isOcean: false,
    raw: data,
  };
}
