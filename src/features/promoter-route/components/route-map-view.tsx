"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, Navigation } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMyRoute } from "@/features/promoter-route/hooks/use-promoter-route";
import type { RouteMapPoint } from "./route-map-canvas";

// Leaflet mexe em `window` no top-level do módulo — chamar a partir do server
// dá `window is not defined`. `ssr:false` é a única fronteira segura.
const RouteMapCanvas = dynamic(
  () =>
    import("./route-map-canvas").then((mod) => ({
      default: mod.RouteMapCanvas,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner />
      </div>
    ),
  },
);

/** Mesmo teto do link do Google Maps — ver `promoter-route-tab.tsx`. */
const MAX_WAYPOINTS = 9;

function navigationUrl(
  points: { latitude: number; longitude: number }[],
): string | null {
  if (points.length === 0) return null;
  const trimmed = points.slice(0, MAX_WAYPOINTS + 1);
  const destination = trimmed[trimmed.length - 1];
  const waypoints = trimmed.slice(0, -1);
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: "driving",
  });
  if (waypoints.length > 0) {
    params.set(
      "waypoints",
      waypoints
        .map((point) => `${point.latitude},${point.longitude}`)
        .join("|"),
    );
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function RouteMapView() {
  const { stops, isLoading } = useMyRoute();

  const points: RouteMapPoint[] = stops.map((stop, index) => ({
    latitude: stop.latitude,
    longitude: stop.longitude,
    name: stop.name,
    position: index + 1,
  }));

  const navUrl = navigationUrl(points);
  const truncated = points.length > MAX_WAYPOINTS + 1;

  return (
    <div className="flex h-full min-h-[calc(100dvh-56px)] flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-background px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Button asChild variant="ghost" size="icon" className="size-9">
            <Link href="/promotor" aria-label="Voltar">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight">Rota do dia</p>
            <p className="truncate text-muted-foreground text-xs">
              {isLoading
                ? "Carregando…"
                : points.length === 0
                  ? "Rota vazia"
                  : `${points.length} parada${points.length > 1 ? "s" : ""}${truncated ? ` · navegar leva as ${MAX_WAYPOINTS + 1} primeiras` : ""}`}
            </p>
          </div>
        </div>
        {navUrl && (
          <Button asChild size="sm" className="gap-1.5">
            <a href={navUrl} target="_blank" rel="noopener noreferrer">
              <Navigation className="size-4" /> Navegar
            </a>
          </Button>
        )}
      </header>

      <div className="min-h-0 flex-1">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : points.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground text-sm">
            Sua rota está vazia. Volte, adicione clientes e retorne para ver o
            traçado.
          </div>
        ) : (
          <RouteMapCanvas points={points} />
        )}
      </div>
    </div>
  );
}
