"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { LocateFixed, MapPin, Search } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { usePublicMapPoints } from "../hooks/use-tradegram";
import type { MapViewport } from "./tradegram-geo-map";

// `ssr: false` só é permitido dentro de um Client Component — o Leaflet mexe em
// `window` já na avaliação do módulo.
const TradeGramGeoMap = dynamic(
  () => import("./tradegram-geo-map").then((mod) => mod.TradeGramGeoMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    ),
  },
);

/** ~1 km. Arrastar menos que isto não deve virar consulta nova. */
const VIEWPORT_STEP = 0.01;
/** Margem além da tela, em fração do lado visível. */
const VIEWPORT_PADDING = 0.35;

const clamp = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, value));

/**
 * Arredonda a área para uma grade, com folga em volta e presa aos limites.
 *
 * A área faz parte da chave da consulta: sem arredondar, cada arrastinho vira
 * requisição; sem prender depois de somar a folga, o retângulo estoura ±90/±180
 * e o servidor recusa com um erro que não diz nada.
 */
function coarsen(viewport: MapViewport, current: MapViewport | null) {
  const padLat = (viewport.north - viewport.south) * VIEWPORT_PADDING;
  const padLng = (viewport.east - viewport.west) * VIEWPORT_PADDING;

  if (
    current &&
    current.south <= viewport.south &&
    current.north >= viewport.north &&
    current.west <= viewport.west &&
    current.east >= viewport.east
  ) {
    return current;
  }

  return {
    south: clamp(
      Math.floor((viewport.south - padLat) / VIEWPORT_STEP) * VIEWPORT_STEP,
      90,
    ),
    west: clamp(
      Math.floor((viewport.west - padLng) / VIEWPORT_STEP) * VIEWPORT_STEP,
      180,
    ),
    north: clamp(
      Math.ceil((viewport.north + padLat) / VIEWPORT_STEP) * VIEWPORT_STEP,
      90,
    ),
    east: clamp(
      Math.ceil((viewport.east + padLng) / VIEWPORT_STEP) * VIEWPORT_STEP,
      180,
    ),
  };
}

/**
 * Primeira tela do TradeGram público: o mapa do varejo brasileiro. Sem login.
 *
 * Desenhada para o celular primeiro. O mapa ocupa TODA a altura útil e a página
 * não rola: num mapa, rolagem de página é o gesto errado — o dedo que queria
 * arrastar o mapa acaba arrastando a tela. Daí `h-dvh` (não `vh`, que no celular
 * ignora a barra do navegador e deixa um pedaço do mapa embaixo do polegar) com
 * o resto em `flex`.
 */
export function TradeGramExplorer() {
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const me = useGeolocation();
  const [focusToken, setFocusToken] = useState(0);

  const handleViewport = useCallback((next: MapViewport) => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    // Só depois que o mapa PARA: sem isto, arrastar dispara uma consulta por
    // quadro de animação.
    settleTimer.current = setTimeout(
      () => setViewport((current) => coarsen(next, current)),
      400,
    );
  }, []);

  const { points, truncated, isLoading } = usePublicMapPoints(viewport);
  const withPage = points.filter((point) => point.path !== null).length;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2 sm:px-4 sm:py-3">
        <Link href="/tradegram" className="shrink-0">
          {/* biome-ignore lint/performance/noImgElement: logo estática em public/ */}
          <img
            src="/tradegram-logo.svg"
            alt="Tradegram"
            className="h-7 w-auto sm:h-8"
          />
        </Link>
        {/* Some no celular: a marca já está do lado e a barra é estreita. */}
        <p className="hidden text-sm text-muted-foreground sm:block">
          O mapa do trade marketing do Brasil
        </p>
        <Button
          type="button"
          variant={me.status === "on" ? "default" : "outline"}
          size="sm"
          className="ml-auto gap-1.5"
          title={
            me.status === "denied"
              ? "Permissão de localização negada no navegador"
              : "Mostrar onde estou"
          }
          onClick={() => {
            if (me.status === "on" && me.position) {
              setFocusToken((token) => token + 1);
              return;
            }
            me.start();
          }}
        >
          {me.status === "asking" ? (
            <Spinner />
          ) : (
            <LocateFixed className="size-4" />
          )}
          <span className="hidden sm:inline">Onde estou</span>
          <span className="sr-only sm:hidden">Onde estou</span>
        </Button>

        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/tradegram/buscar">
            <Search className="size-4" />
            {/* Só o ícone no celular — o rótulo comeria metade da barra. */}
            <span className="hidden sm:inline">Buscar por nome</span>
            <span className="sr-only sm:hidden">Buscar por nome</span>
          </Link>
        </Button>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-[11px] text-muted-foreground sm:px-4 sm:text-xs">
        {isLoading && <Spinner />}
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500 sm:size-2.5" />
          {withPage} com página no TradeGram
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="size-3" />
          {points.length - withPage} do OpenStreetMap
        </span>
        {truncated && (
          <span className="text-amber-600">Aproxime para ver todos</span>
        )}
      </div>

      {/* `min-h-0` é o que permite ao filho encolher dentro do flex — sem ele o
        mapa empurra a página e a barra de baixo some no celular. */}
      <div className="min-h-0 flex-1">
        <TradeGramGeoMap
          points={points}
          onViewportChange={handleViewport}
          myLocation={me.position}
          focus={
            focusToken > 0 && me.position
              ? { ...me.position, token: focusToken }
              : null
          }
        />
      </div>
    </div>
  );
}
