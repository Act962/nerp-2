"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import {
  BRAZIL_CENTER,
  BRAZIL_ZOOM,
  TILE_ATTRIBUTION,
  TILE_URL,
  trailColor,
} from "@/features/mapa-de-campo/lib/leaflet-setup";

export type PinoDoVendedor = {
  memberId: string;
  nome: string;
  latitude: number;
  longitude: number;
  emJornada: boolean;
  detalhe: string;
};

export type PontoDoTrajeto = {
  latitude: number;
  longitude: number;
  origem: string;
};

function icone(nome: string, cor: string) {
  const inicial = nome.trim().slice(0, 1).toUpperCase() || "V";
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:${cor};color:#fff;font:600 12px system-ui;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${inicial}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** Última posição de cada vendedor e, se escolhido, o trajeto do dia. */
export function MapaCanvas({
  pinos,
  trajeto,
  selecionado,
  onSelecionar,
}: {
  pinos: PinoDoVendedor[];
  trajeto: PontoDoTrajeto[];
  selecionado: string | null;
  onSelecionar: (memberId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const camadaRef = useRef<L.LayerGroup | null>(null);
  // Último enquadramento ("equipe" ou o vendedor escolhido): o mapa só se
  // reenquadra quando a escolha muda, não a cada atualização de 30 s.
  const enquadrou = useRef<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: BRAZIL_CENTER,
      zoom: BRAZIL_ZOOM,
      scrollWheelZoom: true,
    });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
    camadaRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const camada = camadaRef.current;
    if (!map || !camada) return;
    camada.clearLayers();

    const limites: L.LatLngExpression[] = [];
    pinos.forEach((pino, indice) => {
      const cor = pino.emJornada ? trailColor(indice) : "#94a3b8";
      const marcador = L.marker([pino.latitude, pino.longitude], {
        icon: icone(pino.nome, cor),
      })
        .bindTooltip(`${pino.nome} · ${pino.detalhe}`)
        .on("click", () => onSelecionar(pino.memberId));
      marcador.addTo(camada);
      limites.push([pino.latitude, pino.longitude]);
    });

    if (trajeto.length > 1) {
      L.polyline(
        trajeto.map(
          (ponto) => [ponto.latitude, ponto.longitude] as L.LatLngTuple,
        ),
        { color: "#2563eb", weight: 3, opacity: 0.8 },
      ).addTo(camada);
      for (const ponto of trajeto.filter((linha) => linha.origem !== "PING")) {
        L.circleMarker([ponto.latitude, ponto.longitude], {
          radius: 6,
          color: "#fff",
          weight: 2,
          fillColor: ponto.origem === "PEDIDO" ? "#16a34a" : "#f59e0b",
          fillOpacity: 1,
        })
          .bindTooltip(
            ponto.origem === "PEDIDO"
              ? "Pedido"
              : ponto.origem === "CHECKIN"
                ? "Check-in"
                : "Check-out",
          )
          .addTo(camada);
      }
    }

    // Enquadra uma vez com a equipe e de novo a cada vendedor escolhido.
    const alvo =
      trajeto.length > 1
        ? trajeto.map(
            (ponto) => [ponto.latitude, ponto.longitude] as L.LatLngTuple,
          )
        : limites;
    const chave = trajeto.length > 1 ? (selecionado ?? "equipe") : "equipe";
    if (alvo.length > 0 && enquadrou.current !== chave) {
      map.fitBounds(L.latLngBounds(alvo as L.LatLngTuple[]).pad(0.2), {
        maxZoom: 15,
      });
      enquadrou.current = chave;
    }
  }, [pinos, trajeto, selecionado, onSelecionar]);

  return (
    <div ref={containerRef} className="h-[480px] w-full rounded-lg border" />
  );
}
