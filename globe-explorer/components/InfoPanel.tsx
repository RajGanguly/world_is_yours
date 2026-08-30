"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { GlobeClickPoint } from "./Globe";

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
}

interface InfoPanelProps {
  point: GlobeClickPoint | null;
  text: string;
  meta: PanelMeta | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

function formatCoord(value: number, posLabel: string, negLabel: string) {
  const dir = value >= 0 ? posLabel : negLabel;
  return `${Math.abs(value).toFixed(2)}° ${dir}`;
}

export default function InfoPanel({ point, text, meta, loading, error, onClose }: InfoPanelProps) {
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
            {/* header */}
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
                  ESC
                </button>
              </div>
            </div>

            {/* body */}
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

              {text && (
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-fog/90">
                  {text}
                  {loading && <span className="ml-0.5 inline-block h-4 w-2 animate-pulse-slow bg-signal align-middle" />}
                </p>
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

              {meta?.wikiUrl && (
                <a
                  href={meta.wikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block font-mono text-xs text-wire hover:text-signal"
                >
                  background reading ↗
                </a>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
