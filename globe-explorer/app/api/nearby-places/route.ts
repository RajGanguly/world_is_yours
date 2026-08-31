export const runtime = "nodejs";

interface NearbyPlaceRequest {
  lat: number;
  lng: number;
  radius?: number;
  limit?: number;
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface PlaceResult {
  name: string;
  category: string;
  type: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

const EARTH_RADIUS_KM = 6371;

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeName(value: string): string | null {
  const name = value.replace(/\s+/g, " ").trim();
  if (!name || /^(amenity|leisure|tourism|shop|local highlight)$/i.test(name)) {
    return null;
  }
  return name;
}

function classifyPlace(tags: Record<string, string> | undefined): string {
  const amenity = (tags?.amenity ?? "").toLowerCase();
  const leisure = (tags?.leisure ?? "").toLowerCase();
  const tourism = (tags?.tourism ?? "").toLowerCase();
  const sport = (tags?.sport ?? "").toLowerCase();
  const shop = (tags?.shop ?? "").toLowerCase();
  const natural = (tags?.natural ?? "").toLowerCase();

  if (["restaurant", "cafe", "fast_food", "food_court", "bar", "pub", "biergarten"].includes(amenity)) return "Dining";
  if (["hotel", "motel", "hostel", "guest_house", "camp_site"].includes(tourism)) return "Stay";
  if (["mall", "department_store", "supermarket"].includes(shop)) return "Shopping";
  if (["park", "nature_reserve", "garden", "playground", "recreation_ground"].includes(leisure)) return "Nature";
  if (["attraction", "viewpoint", "museum", "gallery", "historic", "monument", "zoo", "theme_park"].includes(tourism)) return "Outdoors";
  if (["beach", "wood", "water", "peak", "cliff"].includes(natural)) return "Nature";
  if (["climbing", "hiking", "skiing", "swimming", "cycling", "surfing", "fitness"].includes(sport)) return "Adventure";
  if (["museum", "gallery"].includes(amenity)) return "Culture";
  if (amenity) return titleCase(amenity);
  if (leisure) return titleCase(leisure);
  if (tourism) return titleCase(tourism);
  if (sport) return titleCase(sport);
  if (shop) return titleCase(shop);
  if (natural) return titleCase(natural);

  return "Local highlight";
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<NearbyPlaceRequest>;
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const radius = Number(body.radius ?? 2500);
  const limit = Number(body.limit ?? 8);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ places: [] }, { status: 400 });
  }

  const query = `
    [out:json][timeout:30];
    (
      node(around:${radius},${lat},${lng})[amenity~"restaurant|cafe|fast_food|food_court|bar|pub|biergarten"];
      node(around:${radius},${lat},${lng})[shop~"mall|department_store|supermarket"];
      node(around:${radius},${lat},${lng})[tourism~"hotel|motel|hostel|guest_house|camp_site|museum|attraction|viewpoint|zoo|theme_park|gallery"];
      node(around:${radius},${lat},${lng})[leisure~"park|nature_reserve|garden|playground|recreation_ground|sports_centre|stadium"];
      node(around:${radius},${lat},${lng})[sport~"climbing|hiking|skiing|swimming|cycling|surfing|fitness"];
      node(around:${radius},${lat},${lng})[natural~"beach|wood|water|peak|cliff"];
      way(around:${radius},${lat},${lng})[amenity~"restaurant|cafe|fast_food|food_court|bar|pub|biergarten"];
      way(around:${radius},${lat},${lng})[shop~"mall|department_store|supermarket"];
      way(around:${radius},${lat},${lng})[tourism~"hotel|motel|hostel|guest_house|camp_site|museum|attraction|viewpoint|zoo|theme_park|gallery"];
      way(around:${radius},${lat},${lng})[leisure~"park|nature_reserve|garden|playground|recreation_ground|sports_centre|stadium"];
      way(around:${radius},${lat},${lng})[sport~"climbing|hiking|skiing|swimming|cycling|surfing|fitness"];
      way(around:${radius},${lat},${lng})[natural~"beach|wood|water|peak|cliff"];
      relation(around:${radius},${lat},${lng})[amenity~"restaurant|cafe|fast_food|food_court|bar|pub|biergarten"];
      relation(around:${radius},${lat},${lng})[shop~"mall|department_store|supermarket"];
      relation(around:${radius},${lat},${lng})[tourism~"hotel|motel|hostel|guest_house|camp_site|museum|attraction|viewpoint|zoo|theme_park|gallery"];
      relation(around:${radius},${lat},${lng})[leisure~"park|nature_reserve|garden|playground|recreation_ground|sports_centre|stadium"];
      relation(around:${radius},${lat},${lng})[sport~"climbing|hiking|skiing|swimming|cycling|surfing|fitness"];
      relation(around:${radius},${lat},${lng})[natural~"beach|wood|water|peak|cliff"];
    );
    out center 200;
  `;

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=UTF-8" },
      body: query,
    });

    if (!response.ok) {
      return Response.json({ places: [] }, { status: 502 });
    }

    const json = (await response.json()) as { elements?: OverpassElement[] };
    const elements = json.elements ?? [];
    const seen = new Set<string>();

    const places: PlaceResult[] = elements
      .map((element) => {
        const tags = element.tags ?? {};
        const point = element.center
          ? { lat: element.center.lat, lng: element.center.lon }
          : { lat: element.lat ?? lat, lng: element.lon ?? lng };

        const name = normalizeName(
          String(tags.name ?? tags.brand ?? tags.leisure ?? tags.amenity ?? tags.shop ?? tags.tourism ?? tags.natural ?? "")
        );

        if (!name) {
          return null;
        }

        const category = classifyPlace(tags);
        const distanceKm = haversineKm(lat, lng, point.lat, point.lng);
        const detailKey = `${category}:${name.toLowerCase()}:${point.lat.toFixed(3)}:${point.lng.toFixed(3)}`;

        if (seen.has(detailKey)) {
          return null;
        }
        seen.add(detailKey);

        return {
          name,
          category,
          type: tags.amenity ?? tags.leisure ?? tags.tourism ?? tags.shop ?? tags.sport ?? tags.natural ?? "poi",
          lat: point.lat,
          lng: point.lng,
          distanceKm,
        };
      })
      .filter((entry): entry is PlaceResult => Boolean(entry))
      .filter((entry) => entry.distanceKm <= radius / 1000 + 15)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    return Response.json({ places });
  } catch {
    return Response.json({ places: [] }, { status: 500 });
  }
}
