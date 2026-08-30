"use client";

import { useCallback, useEffect, useRef } from "react";
import ReactGlobe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import type { GlobeClickPoint } from "@/components/Globe";

interface GlobeCanvasProps {
  width: number;
  height: number;
  onLocationClick: (point: GlobeClickPoint) => void;
  activePoint: GlobeClickPoint | null;
}

export default function GlobeCanvas({
  width,
  height,
  onLocationClick,
  activePoint,
}: GlobeCanvasProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const lastClickRef = useRef(0);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    g.controls().autoRotate = true;
    g.controls().autoRotateSpeed = 0.4;
    g.controls().enableZoom = true;
    g.controls().minDistance = 100.15;
    g.controls().maxDistance = 650;
    g.controls().zoomSpeed = 1.5;
    g.pointOfView({ altitude: 2.2 }, 0);
  }, []);

  const handleClick = useCallback(
    ({ lat, lng }: GlobeClickPoint) => {
      const now = Date.now();
      if (now - lastClickRef.current < 500) return;
      lastClickRef.current = now;

      const g = globeRef.current;
      if (g) g.controls().autoRotate = false;

      onLocationClick({ lat, lng });
    },
    [onLocationClick]
  );

  const pointsData = activePoint
    ? [{ lat: activePoint.lat, lng: activePoint.lng, size: 1 }]
    : [];

  return (
    <ReactGlobe
      ref={globeRef}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
      bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
      atmosphereColor="#e8b04b"
      atmosphereAltitude={0.18}
      onGlobeClick={handleClick}
      pointsData={pointsData}
      pointLat="lat"
      pointLng="lng"
      pointColor={() => "#e8b04b"}
      pointAltitude={0.01}
      pointRadius={0.6}
      pointsMerge={false}
      ringsData={activePoint ? [activePoint] : []}
      ringLat="lat"
      ringLng="lng"
      ringColor={() => (t: number) => `rgba(232,176,75,${1 - t})`}
      ringMaxRadius={4}
      ringPropagationSpeed={2.5}
      ringRepeatPeriod={900}
    />
  );
}