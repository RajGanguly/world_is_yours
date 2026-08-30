"use client";

import { useCallback, useEffect, useState } from "react";
import Globe, { type GlobeClickPoint } from "@/components/Globe";
import InfoPanel, { type PanelMeta } from "@/components/InfoPanel";

export default function Home() {
  const [point, setPoint] = useState<GlobeClickPoint | null>(null);
  const [text, setText] = useState("");
  const [meta, setMeta] = useState<PanelMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setPoint(null);
    setText("");
    setMeta(null);
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
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/location-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
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
            });
          } catch {
            
          }
        } else {
          setText(buffer);
        }
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

      <div className="pointer-events-none absolute left-6 top-6 z-10 max-w-sm sm:left-10 sm:top-10">
        <p className="font-mono text-[11px] tracking-widest-plus text-signal">Know Your World</p>
        <h1 className="mt-2 font-display text-2xl font-semibold leading-tight text-fog sm:text-3xl">
          
          <br />
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-mist">
          Our Philosophy: All facts about anywhere, just a click away.
        </p>
      </div>

      <div className="absolute inset-0">
        <Globe onLocationClick={handleLocationClick} activePoint={point} />
      </div>

      <InfoPanel
        point={point}
        text={text}
        meta={meta}
        loading={loading}
        error={error}
        onClose={handleClose}
      />
    </main>
  );
}
