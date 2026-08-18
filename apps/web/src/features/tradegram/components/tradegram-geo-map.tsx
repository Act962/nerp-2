"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  BRAZIL_CENTER,
  BRAZIL_ZOOM,
  PIN_COLOR,
  TILE_ATTRIBUTION,
  TILE_URL,
} from "@/features/mapa-de-campo/lib/leaflet-setup";
import {
  createLocationMarkers,
  createStorePin,
} from "@/features/mapa-de-campo/lib/pin-marker";
import { escapeHtml } from "@/lib/escape-html";
import { useEffect, useRef } from "react";

export interface PublicMapPoint {
  kind: "STORE" | "DIRECTORY";
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  address: string | null;
  logoKey: string | null;
  path: string | null;
}

export interface MapViewport {
  south: number;
  west: number;
  north: number;
  east: number;
}

function popupHtml(point: PublicMapPoint): string {
  const place = [point.city, point.state].filter(Boolean).join(" / ");
  return [
    `<strong>${escapeHtml(point.name)}</strong>`,
    point.address ? escapeHtml(point.address) : null,
    place ? escapeHtml(place) : null,
    point.path
      ? `<a href="${escapeHtml(point.path)}" style="display:inline-block;margin-top:6px;padding:3px 8px;border:1px solid currentColor;border-radius:6px;color:inherit;text-decoration:none;font:inherit">Ver no TradeGram</a>`
      : `<span style="opacity:.7">Ponto do OpenStreetMap</span>`,
  ]
    .filter(Boolean)
    .join("<br/>");
}

/**
 * Mapa do app público. Escrito à parte do `FieldMapCanvas` de propósito.
 *
 * O canvas do mapa de campo carrega onze props — trajeto, modo de cadastro,
 * catálogo, logo, busca — e quatro efeitos que já disputam o enquadramento.
 * Aqui são duas. Compartilhar seria tornar nove props opcionais e enfiar um
 * quinto tipo de pino lá dentro; o que se reaproveita são as PRIMITIVAS
 * (`createStorePin`, `escapeHtml`, as constantes do Leaflet), que é onde mora
 * a consistência visual de verdade.
 */
export function TradeGramGeoMap({
  points,
  onViewportChange,
  myLocation,
  focus,
  className = "h-full w-full",
}: {
  points: PublicMapPoint[];
  onViewportChange?: (viewport: MapViewport) => void;
  /** Posição de quem está olhando — o ponto azul. */
  myLocation?: { latitude: number; longitude: number; accuracy: number } | null;
  /** Muda de valor para centralizar no ponto azul. */
  focus?: { latitude: number; longitude: number; token: number } | null;
  /** Quem enquadra é o pai: no celular o mapa ocupa a tela inteira. */
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const meLayerRef = useRef<L.LayerGroup | null>(null);
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: BRAZIL_CENTER,
      zoom: BRAZIL_ZOOM,
      preferCanvas: true,
      // Embaixo à direita: em pé, no celular, é onde o polegar alcança — e não
      // disputa espaço com o cabeçalho.
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(
      map,
    );

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    meLayerRef.current = L.layerGroup().addTo(map);

    // Preso em ±90/±180: afastado o bastante, o mundo se repete na horizontal e
    // o Leaflet devolve longitude fora do intervalo, que o servidor recusa.
    const clamp = (value: number, limit: number) =>
      Math.max(-limit, Math.min(limit, value));

    const publish = () => {
      const bounds = map.getBounds();
      onViewportChangeRef.current?.({
        south: clamp(bounds.getSouth(), 90),
        west: clamp(bounds.getWest(), 180),
        north: clamp(bounds.getNorth(), 90),
        east: clamp(bounds.getEast(), 180),
      });
    };
    map.on("moveend", publish);
    publish();

    // O guard do ref acima não é zelo: o StrictMode roda o efeito duas vezes e
    // o segundo `L.map()` no mesmo nó lança "Map container is already
    // initialized".
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      meLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => mapRef.current?.invalidateSize());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    layer.clearLayers();
    for (const point of points) {
      createStorePin({
        latitude: point.latitude,
        longitude: point.longitude,
        logoUrl: point.logoKey ? constructUrl(point.logoKey) : null,
        // Loja com página é carteira confirmada; ponto do OSM é posição
        // aproximada. Mesma escala do mapa de campo, para quem usa os dois.
        ringColor:
          point.kind === "STORE" ? PIN_COLOR.reliable : PIN_COLOR.approximate,
      })
        .bindPopup(popupHtml(point))
        .addTo(layer);
    }
  }, [points]);

  useEffect(() => {
    const layer = meLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!myLocation) return;
    for (const marker of createLocationMarkers(myLocation)) marker.addTo(layer);
  }, [myLocation]);

  useEffect(() => {
    if (!focus) return;
    mapRef.current?.flyTo([focus.latitude, focus.longitude], 16, {
      duration: 0.8,
    });
  }, [focus]);

  return (
    // Altura explícita é obrigatória: sem ela o Leaflet renderiza um mapa de
    // 0px sem erro nenhum — por isso o padrão de `className` já traz `h-full`.
    <div ref={containerRef} className={`field-map-shell ${className}`} />
  );
}
