"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import Globe, { type GlobeClickPoint } from "@/components/Globe";
import InfoPanel, { type PanelMeta } from "@/components/InfoPanel";
import {
  persistUserLocation,
  readUserLocation,
  type NearbyPlace,
  type UserLocation,
} from "@/lib/places";

const FlatMap = dynamic(() => import("@/components/FlatMap"), {
  ssr: false,
});

type ViewMode = "globe" | "map";

export default function Home() {
  const [point, setPoint] = useState<GlobeClickPoint | null>(null);
  const [text, setText] = useState("");
  const [meta, setMeta] = useState<PanelMeta | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("globe");

  useEffect(() => {
    const cachedLocation = readUserLocation();
    if (cachedLocation) {
      setUserLocation(cachedLocation);
      return;
    }

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      fetch("https://ipapi.co/json/")
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (!data || typeof data.latitude !== "number" || typeof data.longitude !== "number") return;
          const loc: UserLocation = {
            lat: data.latitude,
            lng: data.longitude,
            source: "ip",
            cachedAt: Date.now(),
          };
          persistUserLocation(loc);
          setUserLocation(loc);
        })
        .catch(() => undefined);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const loc: UserLocation = {
          lat: coords.latitude,
          lng: coords.longitude,
          source: "browser",
          cachedAt: Date.now(),
        };
        persistUserLocation(loc);
        setUserLocation(loc);
      },
      () => {
        fetch("https://ipapi.co/json/")
          .then((response) => response.ok ? response.json() : null)
          .then((data) => {
            if (!data || typeof data.latitude !== "number" || typeof data.longitude !== "number") return;
            const loc: UserLocation = {
              lat: data.latitude,
              lng: data.longitude,
              source: "ip",
              cachedAt: Date.now(),
            };
            persistUserLocation(loc);
            setUserLocation(loc);
          })
          .catch(() => undefined);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 600000 },
    );
  }, []);

  const handleClose = useCallback(() => {
    setPoint(null);
    setText("");
    setMeta(null);
    setPlaces([]);
    setError(null);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  const handleLocationClick = useCallback(async (p: GlobeClickPoint) => {
    setPoint(p);
    setText("");
    setMeta(null);
    setPlaces([]);
    setError(null);
    setLoading(true);

    try {
      const [locationResponse, nearbyResponse] = await Promise.all([
        fetch("/api/location-info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        }),
        fetch("/api/nearby-places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: p.lat,
            lng: p.lng,
            radius: 2500,
            limit: 6,
          }),
        }),
      ]);

      if (!locationResponse.ok || !locationResponse.body) {
        throw new Error(`Request failed (${locationResponse.status})`);
      }

      const reader = locationResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const metaIdx = buffer.indexOf("@@META@@");
        if (metaIdx !== -1) {
          const prose = buffer.slice(0, metaIdx);
          const metaJson = buffer.slice(metaIdx + "@@META@@".length);
          setText(prose);
          try {
            const parsed = JSON.parse(metaJson);
            setMeta({
              label: parsed.label,
              country: parsed.country,
              isOcean: parsed.isOcean,
              sources: parsed.sources ?? [],
              wikiUrl: parsed.wikiUrl,
              facts: parsed.facts ?? null,
              weather: parsed.weather ?? null,
            });
          } catch {
            setMeta(null);
          }
        } else {
          setText(buffer);
        }
      }

      if (nearbyResponse.ok) {
        const nearbyData = (await nearbyResponse.json()) as { places?: NearbyPlace[] };
        setPlaces(Array.isArray(nearbyData.places) ? nearbyData.places : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-void">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade" />

      <div className="pointer-events-none absolute left-6 top-2 z-10 max-w-sm sm:left-10 sm:top-10">
        <p className="font-mono text-[11px] tracking-widest-plus text-signal">Know Your World</p>
        <p className="mt-1 text-sm leading-relaxed text-mist">
          All facts about anywhere, just a click away.
        </p>
      </div>

      <div className="absolute right-6 top-6 z-20 w-36 sm:right-10 sm:top-10">
        <label className="mb-2 block font-mono text-[10px] tracking-widest-plus text-mist">
          VIEW MODE
        </label>
        <div className="relative">
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as ViewMode)}
            className="w-full appearance-none rounded-lg border border-line bg-panel/85 px-3 py-2.5 pr-9 font-mono text-xs text-fog shadow-lg shadow-void/40 backdrop-blur-sm transition-colors hover:border-signal focus:border-signal"
            aria-label="Choose map view"
          >
            <option value="globe">Globe</option>
            <option value="map">Map</option>
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-signal">
            &#9662;
          </span>
        </div>
      </div>

      {viewMode === "globe" ? (
        <div className="absolute inset-0">
          <Globe onLocationClick={handleLocationClick} activePoint={point} />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-start pl-4 pt-24 sm:pl-6 md:pl-8 md:pt-8">
          <div className="pointer-events-auto h-[560px] w-[clamp(320px,46vw,720px)] overflow-hidden rounded-2xl border border-line bg-[#0a0d12] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <FlatMap onLocationClick={handleLocationClick} activePoint={point} />
          </div>
        </div>
      )}

      <InfoPanel
        point={point}
        text={text}
        meta={meta}
        userLocation={userLocation}
        places={places}
        loading={loading}
        error={error}
        onClose={handleClose}
      />
    </main>
  );
}
