export interface UserLocation {
  lat: number;
  lng: number;
  source: "browser" | "ip";
  cachedAt: number;
}

export interface NearbyPlace {
  name: string;
  category: string;
  type: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

export const USER_LOCATION_KEY = "globe-explorer:user-location";

export function readUserLocation(): UserLocation | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(USER_LOCATION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<UserLocation>;
    if (
      typeof parsed.lat !== "number" ||
      typeof parsed.lng !== "number" ||
      typeof parsed.cachedAt !== "number"
    ) {
      return null;
    }

    const ageMs = Date.now() - parsed.cachedAt;
    const maxAgeMs = 1000 * 60 * 60 * 24 * 7;
    if (ageMs > maxAgeMs) {
      window.localStorage.removeItem(USER_LOCATION_KEY);
      return null;
    }

    return {
      lat: parsed.lat,
      lng: parsed.lng,
      source: parsed.source === "ip" ? "ip" : "browser",
      cachedAt: parsed.cachedAt,
    };
  } catch {
    return null;
  }
}

export function persistUserLocation(loc: UserLocation): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(USER_LOCATION_KEY, JSON.stringify(loc));
  } catch {
    // Ignore cache quota issues in restricted browser contexts.
  }
}

function normalizeDirectionsDestination(name?: string | null, country?: string | null): string | null {
  const cleanName = name?.trim();
  if (!cleanName) return null;

  const parts = cleanName
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return cleanName;
  }

  if (country) {
    const countryName = country.trim();
    const city = parts[0];
    if (city && countryName) {
      return `${city}, ${countryName}`;
    }
  }

  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[parts.length - 1]}`;
  }

  return cleanName;
}

export function buildGoogleDirectionsUrl(
  destination: { lat: number; lng: number; name?: string | null; country?: string | null },
  origin?: UserLocation | null,
): string {
  const destinationLabel = normalizeDirectionsDestination(destination.name, destination.country);
  const destinationParam = destinationLabel
    ? encodeURIComponent(destinationLabel)
    : `${destination.lat},${destination.lng}`;

  if (origin) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destinationParam}`;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${destinationParam}`;
}

export function buildGoogleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function buildGoogleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}
