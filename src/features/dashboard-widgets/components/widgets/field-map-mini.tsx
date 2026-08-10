"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';

const STORE_COLOR = "#10b981";
const PROMOTER_COLOR = "#7c3aed";

interface Pin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  type: "store" | "promoter";
  detail?: string;
}

export default function FieldMapMini({ pins }: { pins: Pin[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker || layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    if (pins.length === 0) {
      map.setView([-14.235, -51.925], 4);
      return;
    }

    const bounds = L.latLngBounds([]);

    for (const pin of pins) {
      const color = pin.type === "store" ? STORE_COLOR : PROMOTER_COLOR;
      const marker = L.circleMarker([pin.lat, pin.lng], {
        radius: pin.type === "store" ? 5 : 7,
        weight: 2,
        color: "#ffffff",
        fillColor: color,
        fillOpacity: 1,
      });
      const tooltip = pin.detail ? `${pin.label} — ${pin.detail}` : pin.label;
      marker.bindTooltip(tooltip, { direction: "top", offset: [0, -6] });
      marker.addTo(map);
      bounds.extend([pin.lat, pin.lng]);
    }

    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
  }, [pins]);

  if (pins.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhum ponto com localização encontrado.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full rounded-md overflow-hidden"
    />
  );
}
