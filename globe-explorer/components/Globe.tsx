"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";

const GlobeCanvas = dynamic(() => import("@/components/GlobeCanvas"), { ssr: false });

export interface GlobeClickPoint {
  lat: number;
  lng: number;
}

interface GlobeProps {
  onLocationClick: (point: GlobeClickPoint) => void;
  activePoint: GlobeClickPoint | null;
}

export default function Globe({ onLocationClick, activePoint }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 800 });
  const lastClickRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full">
      <GlobeCanvas
        width={dims.width}
        height={dims.height}
        onLocationClick={onLocationClick}
        activePoint={activePoint}
      />
    </div>
  );
}
