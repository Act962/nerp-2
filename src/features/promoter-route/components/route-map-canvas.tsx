"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import {
  BRAZIL_CENTER,
  BRAZIL_ZOOM,
  PIN_COLOR,
  TILE_ATTRIBUTION,
  TILE_URL,
} from "@/features/mapa-de-campo/lib/leaflet-setup";

export interface RouteMapPoint {
  latitude: number;
  longitude: number;
  name: string;
  position: number;
}

/**
 * Mapa da rota do dia — Leaflet puro (o projeto não usa react-leaflet).
 *
 * O ÚNICO caminho é `dynamic(..., { ssr: false })` no chamador: o Leaflet mexe
 * em `window` já na avaliação do módulo, e o servidor derrubaria a página.
 *
 * Rota por VIAS via OSRM público (`router.project-osrm.org`). Se falhar — rede,
 * rate limit informal do servidor grátis, coordenada fora da malha —, cai para
 * linha reta entre paradas. Nunca deixa o mapa em branco: o promotor está em
 * campo e um "carregando..." travado seria pior que a régua reta.
 */
export function RouteMapCanvas({ points }: { points: RouteMapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Layer | null>(null);
  const [routeStatus, setRouteStatus] = useState<
    "loading" | "osrm" | "fallback"
  >("loading");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: BRAZIL_CENTER,
      zoom: BRAZIL_ZOOM,
      zoomControl: true,
    });
    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || points.length === 0) return;

    // Pinos numerados 1, 2, 3… — a ordem é a decisão do promotor, e o número é
    // o que a lista lateral também mostra. Cor `PIN_COLOR.route` deliberada:
    // rota é decisão, não geografia — mesma paleta do mapa-de-campo.
    const markers: L.Marker[] = points.map((point) =>
      L.marker([point.latitude, point.longitude], {
        icon: L.divIcon({
          className: "",
          html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:${PIN_COLOR.route};color:#fff;font-weight:600;font-size:13px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${point.position}</span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        title: point.name,
      }).bindPopup(
        `<strong>${point.position}. ${point.name.replace(/[<>&]/g, "")}</strong>`,
      ),
    );
    const markerLayer = L.layerGroup(markers).addTo(map);

    // Enquadra tudo com folga. `.fitBounds` sozinho encosta o pino na borda.
    const bounds = L.latLngBounds(
      points.map((point) => [point.latitude, point.longitude]),
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });

    const abort = new AbortController();
    (async () => {
      const fallback = () => {
        if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);
        routeLayerRef.current = L.polyline(
          points.map((point) => [point.latitude, point.longitude]),
          {
            color: PIN_COLOR.route,
            weight: 4,
            opacity: 0.65,
            dashArray: "6 8",
          },
        ).addTo(map);
        setRouteStatus("fallback");
      };

      // Pelo menos duas paradas para haver rota a desenhar.
      if (points.length < 2) return;
      // OSRM público tem limite informal ~1req/s e não aceita mais que ~100
      // waypoints. As duas condições são satisfeitas aqui — a rota do promotor
      // é limitada por `MAX_WAYPOINTS`.
      const coords = points
        .map((point) => `${point.longitude},${point.latitude}`)
        .join(";");
      const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
      try {
        const res = await fetch(url, { signal: abort.signal });
        if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
        const data = (await res.json()) as {
          routes?: {
            geometry?: { coordinates?: [number, number][] };
          }[];
        };
        const geometry = data.routes?.[0]?.geometry?.coordinates;
        if (!geometry || geometry.length === 0)
          throw new Error("sem geometria");
        if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);
        // OSRM devolve [lng, lat]; Leaflet espera [lat, lng].
        const latlngs = geometry.map(
          ([lng, lat]) => [lat, lng] as [number, number],
        );
        routeLayerRef.current = L.polyline(latlngs, {
          color: PIN_COLOR.route,
          weight: 5,
          opacity: 0.85,
        }).addTo(map);
        setRouteStatus("osrm");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        fallback();
      }
    })();

    return () => {
      abort.abort();
      markerLayer.remove();
      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }
    };
  }, [points]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {routeStatus !== "osrm" && (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow">
          {routeStatus === "loading"
            ? "Traçando pelas ruas…"
            : "Sem rota por ruas — mostrando linha reta"}
        </div>
      )}
    </div>
  );
}
