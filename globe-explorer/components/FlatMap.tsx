"use client";

import { useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import type { GlobeClickPoint } from "@/components/Globe";
import L from "leaflet";

interface FlatMapProps {
  onLocationClick: (point: GlobeClickPoint) => void;
  activePoint: GlobeClickPoint | null;
}

const mapTileUrl = `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_CARTO_API_KEY}`;

const customMarkerIcon =
  typeof window !== "undefined"
    ? L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      })
    : undefined;

function MapClickHandler({ onLocationClick }: { onLocationClick: (point: GlobeClickPoint) => void }) {
  const lastClickRef = useRef(0);

  useMapEvents({
    click: (event) => {
      const now = Date.now();
      if (now - lastClickRef.current < 500) return;
      lastClickRef.current = now;

      onLocationClick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  return null;
}

export default function FlatMap({ onLocationClick, activePoint }: FlatMapProps) {
  const activePosition = useMemo<LatLngExpression | null>(() => {
    if (!activePoint) return null;
    return [activePoint.lat, activePoint.lng];
  }, [activePoint]);

  return (
    <div className="h-full w-full overflow-hidden bg-[#0a0d12]">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={1}
        maxZoom={10}
        scrollWheelZoom
        zoomControl
        worldCopyJump
        className="h-full w-full"
        style={{ width: "100%", height: "100%", background: "#0a0d12" }}
      >
        <TileLayer
          maxZoom={20}
          maxNativeZoom={19}
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          url={mapTileUrl}
        />
        <MapClickHandler onLocationClick={onLocationClick} />

        {activePosition && activePoint && (
          <Marker position={activePosition} icon={customMarkerIcon}>
            <Popup>
              <div className="font-sans text-sm text-slate-800">
                {activePoint.lat.toFixed(2)}°, {activePoint.lng.toFixed(2)}°
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
