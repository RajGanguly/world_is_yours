"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GlobeClickPoint } from "./Globe";
import {
  buildGoogleDirectionsUrl,
  buildGoogleMapsSearchUrl,
  buildGoogleSearchUrl,
  type NearbyPlace,
  type UserLocation,
} from "@/lib/places";

export interface SourceArticle {
  title: string;
  url: string;
  source: string;
}

export interface PanelMeta {
  label: string;
  country?: string;
  isOcean: boolean;
  sources: SourceArticle[];
  wikiUrl: string | null;
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
  weather: {
    temperatureC: number;
    humidity: number;
    windKmh: number;
    conditions: string;
    summary: string;
  } | null;
}

interface InfoPanelProps {
  point: GlobeClickPoint | null;
  text: string;
  meta: PanelMeta | null;
  userLocation: UserLocation | null;
  places: NearbyPlace[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

function formatCoord(value: number, posLabel: string, negLabel: string) {
  const dir = value >= 0 ? posLabel : negLabel;
  return `${Math.abs(value).toFixed(2)}° ${dir}`;
}

export default function InfoPanel({
  point,
  text,
  meta,
  userLocation,
  places,
  loading,
  error,
  onClose,
}: InfoPanelProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "travel" | "discover">("overview");
  const directionsUrl = point
    ? buildGoogleDirectionsUrl(
        { lat: point.lat, lng: point.lng, name: meta?.label ?? null, country: meta?.country ?? null },
        userLocation,
      )
    : "";
  const placeQuery = meta?.label ? meta.label : point ? `${point.lat}, ${point.lng}` : "destination";
  const nearbySearchLinks = [
    { label: "Parks", href: buildGoogleMapsSearchUrl(`${placeQuery} park`) },
    { label: "Hotels", href: buildGoogleMapsSearchUrl(`${placeQuery} hotel`) },
    { label: "Dining", href: buildGoogleMapsSearchUrl(`${placeQuery} restaurant`) },
    { label: "Nature", href: buildGoogleMapsSearchUrl(`${placeQuery} nature trails`) },
    { label: "Bars", href: buildGoogleMapsSearchUrl(`${placeQuery} bar`) },
    { label: "Shopping", href: buildGoogleMapsSearchUrl(`${placeQuery} mall`) },
  ];

  return (
    <AnimatePresence>
      {point && (
        <motion.aside
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="pointer-events-auto absolute right-0 top-0 z-20 h-full w-full max-w-md
                     border-l border-line bg-panel/95 backdrop-blur-sm sm:right-6 sm:top-6 sm:h-[calc(100%-3rem)]
                     sm:rounded-lg sm:border"
        >
          <div className="flex h-full flex-col">
            <div className="relative overflow-hidden border-b border-line px-5 py-4">
              <div className="scanline-bg absolute inset-0 animate-scan opacity-[0.04]" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] tracking-widest-plus text-signal">
                    COORDINATES LOCKED
                  </p>
                  <h2 className="mt-1 font-display text-xl font-semibold text-fog">
                    {meta?.label ?? "Resolving location…"}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-mist">
                    {formatCoord(point.lat, "N", "S")} · {formatCoord(point.lng, "E", "W")}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close panel"
                  className="rounded-md border border-line px-2 py-1 font-mono text-xs text-mist
                             transition-colors hover:border-signal hover:text-signal"
                >
                  CLOSE
                </button>
              </div>
            </div>

            <div className="border-b border-line px-5 py-3">
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-line bg-line/10 p-1">
                {[
                  { key: "overview", label: "Overview" },
                  { key: "travel", label: "Travel" },
                  { key: "discover", label: "Discover" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key as "overview" | "travel" | "discover")}
                    className={`rounded-md px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
                      activeTab === tab.key
                        ? "bg-signal text-void"
                        : "text-mist hover:text-fog"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loading && !text && (
                <div className="space-y-2" aria-live="polite" aria-busy="true">
                  <p className="font-mono text-xs text-signalDim">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse-slow rounded-full bg-signal align-middle" />
                    <span className="ml-2">gathering sources…</span>
                  </p>
                  <div className="mt-4 space-y-2">
                    {[100, 92, 96, 60].map((w, i) => (
                      <div
                        key={i}
                        className="h-3 animate-pulse rounded bg-line"
                        style={{ width: `${w}%` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
                  Couldn&apos;t reach the briefing service: {error}
                </p>
              )}

              {activeTab === "overview" && (
                <>
                  {text && (
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-fog/90">
                      {text}
                      {loading && <span className="ml-0.5 inline-block h-4 w-2 animate-pulse-slow bg-signal align-middle" />}
                    </p>
                  )}

                  {(meta?.facts || meta?.weather) && (
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      {meta?.weather && (
                        <div className="rounded-md border border-line bg-line/10 p-2.5">
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signalDim">Weather</p>
                          <p className="mt-2 text-sm font-medium text-fog">{meta.weather.conditions}</p>
                          <p className="mt-1 text-xs text-mist">{meta.weather.summary}</p>
                        </div>
                      )}

                      {meta?.facts?.population && (
                        <div className="rounded-md border border-line bg-line/10 p-2.5">
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signalDim">Population</p>
                          <p className="mt-2 text-sm font-medium text-fog">{meta.facts.population.toLocaleString()}</p>
                        </div>
                      )}

                      {meta?.facts?.currency && (
                        <div className="rounded-md border border-line bg-line/10 p-2.5">
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signalDim">Currency</p>
                          <p className="mt-2 text-sm font-medium text-fog">{meta.facts.currency}</p>
                        </div>
                      )}

                      {meta?.facts?.region && (
                        <div className="rounded-md border border-line bg-line/10 p-2.5">
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signalDim">Region</p>
                          <p className="mt-2 text-sm font-medium text-fog">{meta.facts.region}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {activeTab === "travel" && (
                <div className="space-y-5">
                  {(meta?.wikiUrl || directionsUrl || meta?.weather || meta?.facts) && (
                    <div className="flex flex-wrap gap-2">
                      {meta?.wikiUrl && (
                        <a
                          href={meta.wikiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-md border border-line bg-line/30 px-3 py-2 font-mono text-[11px] text-wire transition-colors hover:border-signal hover:text-signal"
                        >
                          Wikipedia
                        </a>
                      )}

                      {directionsUrl && (
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-md border border-signal/50 bg-signal/10 px-3 py-2 font-mono text-[11px] text-signal transition-colors hover:border-signal hover:bg-signal/15"
                        >
                          Directions
                        </a>
                      )}

                      {meta?.weather && (
                        <a
                          href={buildGoogleSearchUrl(`${meta.label} weather`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-md border border-line bg-line/30 px-3 py-2 font-mono text-[11px] text-wire transition-colors hover:border-signal hover:text-signal"
                        >
                          Weather
                        </a>
                      )}

                      {meta?.facts?.population && (
                        <a
                          href={buildGoogleSearchUrl(`${meta.label} population`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-md border border-line bg-line/30 px-3 py-2 font-mono text-[11px] text-wire transition-colors hover:border-signal hover:text-signal"
                        >
                          Population
                        </a>
                      )}

                      {meta?.facts?.currency && (
                        <a
                          href={buildGoogleSearchUrl(`${meta.country ?? meta.label} currency`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-md border border-line bg-line/30 px-3 py-2 font-mono text-[11px] text-wire transition-colors hover:border-signal hover:text-signal"
                        >
                          Currency
                        </a>
                      )}

                      {(meta?.facts?.region || meta?.facts?.subregion) && (
                        <a
                          href={buildGoogleSearchUrl(`${meta.country ?? meta.label} economy`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-md border border-line bg-line/30 px-3 py-2 font-mono text-[11px] text-wire transition-colors hover:border-signal hover:text-signal"
                        >
                          Economy
                        </a>
                      )}

                      {(meta?.label || point) && (
                        <a
                          href={buildGoogleSearchUrl(`${meta?.label ?? `${point?.lat}, ${point?.lng}`} topography`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-md border border-line bg-line/30 px-3 py-2 font-mono text-[11px] text-wire transition-colors hover:border-signal hover:text-signal"
                        >
                          Topography
                        </a>
                      )}
                    </div>
                  )}

                  <div className="grid gap-2">
                    {meta?.weather && (
                      <div className="rounded-md border border-line bg-line/10 p-3">
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signalDim">Weather</p>
                        <p className="mt-2 text-sm font-medium text-fog">{meta.weather.conditions}</p>
                        <p className="mt-1 text-xs text-mist">{meta.weather.summary}</p>
                      </div>
                    )}

                    {meta?.facts?.population && (
                      <div className="rounded-md border border-line bg-line/10 p-3">
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signalDim">Population</p>
                        <p className="mt-2 text-sm font-medium text-fog">{meta.facts.population.toLocaleString()}</p>
                      </div>
                    )}

                    {meta?.facts?.currency && (
                      <div className="rounded-md border border-line bg-line/10 p-3">
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signalDim">Currency</p>
                        <p className="mt-2 text-sm font-medium text-fog">{meta.facts.currency}</p>
                      </div>
                    )}

                    {meta?.facts?.region && (
                      <div className="rounded-md border border-line bg-line/10 p-3">
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signalDim">Economy</p>
                        <p className="mt-2 text-sm font-medium text-fog">{meta.facts.economy ?? meta.facts.region}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "discover" && (
                <div className="space-y-5">
                  <div>
                    <p className="font-mono text-[11px] tracking-widest-plus text-mist">PLACES TO VISIT</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {nearbySearchLinks.map((link) => (
                        <a
                          key={link.label}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-md border border-line bg-line/20 px-2.5 py-1.5 font-mono text-[10px] text-wire transition-colors hover:border-signal hover:text-signal"
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>

                  {places.length > 0 && (
                    <div>
                      <p className="font-mono text-[11px] tracking-widest-plus text-mist">GOOD PLACES</p>
                      <ul className="mt-3 space-y-2">
                        {places.map((place) => (
                          <li key={`${place.name}-${place.lat}-${place.lng}`} className="rounded-md border border-line bg-line/10 p-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-fog">{place.name}</p>
                                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-signalDim">
                                  {place.category}
                                </p>
                              </div>
                              <span className="font-mono text-[10px] text-mist">{place.distanceKm.toFixed(1)} km</span>
                            </div>
                            <a
                              href={buildGoogleDirectionsUrl({ lat: place.lat, lng: place.lng, name: place.name }, userLocation)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-block font-mono text-[10px] text-wire hover:text-signal"
                            >
                              route here ↗
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {meta && meta.sources.length > 0 && (
                <div className="mt-6">
                  <p className="font-mono text-[11px] tracking-widest-plus text-mist">SOURCES</p>
                  <ul className="mt-2 space-y-1.5">
                    {meta.sources.map((s, i) => (
                      <li key={i}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-baseline gap-2 text-sm text-mist hover:text-signal"
                        >
                          <span className="font-mono text-xs text-signalDim">{String(i + 1).padStart(2, "0")}</span>
                          <span className="truncate underline decoration-line underline-offset-2 group-hover:decoration-signal">
                            {s.title}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
