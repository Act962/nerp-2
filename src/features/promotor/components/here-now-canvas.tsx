"use client";

// Aba "Estou aqui" do App Vendedor: mostra o vendedor no mapa com raio de
// incerteza (posição aproximada por padrão pra economizar bateria/tempo) e
// um botão que dispara a leitura de alta precisão sob demanda — só nesse
// clique o navegador negocia GPS/wifi/lte pra chegar em ~10m.

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LocateFixed, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  BRAZIL_CENTER,
  BRAZIL_ZOOM,
  PIN_COLOR,
  TILE_ATTRIBUTION,
  TILE_URL,
} from "@/features/mapa-de-campo/lib/leaflet-setup";
import { cn } from "@/lib/utils";

interface Position {
  latitude: number;
  longitude: number;
  /** Raio de incerteza em metros (o próprio browser devolve). */
  accuracy: number;
  /** True quando veio da leitura precisa (botão "Estou aqui"). */
  precise: boolean;
}

// Marker circular colorido — verde = preciso (< 25m), âmbar = aproximado.
// Reusa a semântica de PIN_COLOR do mapa-de-campo: `reliable` × `approximate`.
function makeMarkerIcon(precise: boolean) {
  const color = precise ? PIN_COLOR.reliable : PIN_COLOR.approximate;
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export function HereNowCanvas() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyRingRef = useRef<L.Circle | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [supported] = useState(
    () => typeof navigator !== "undefined" && "geolocation" in navigator,
  );

  // Sobe o mapa uma única vez. Fica esperando `position` pra pular do centro
  // do Brasil pra localização do vendedor no primeiro fix.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: BRAZIL_CENTER,
      zoom: BRAZIL_ZOOM,
      // Zoom com scroll atrapalha em mobile: o dedo rolando a página muda o
      // zoom sem querer. Toque duplo pra zoom cobre 99% do caso de uso.
      scrollWheelZoom: false,
    });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Redesenha marker + ring de precisão sempre que a posição muda.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position) return;
    const center: L.LatLngExpression = [position.latitude, position.longitude];

    if (markerRef.current) markerRef.current.remove();
    markerRef.current = L.marker(center, {
      icon: makeMarkerIcon(position.precise),
    }).addTo(map);

    if (accuracyRingRef.current) accuracyRingRef.current.remove();
    accuracyRingRef.current = L.circle(center, {
      radius: position.accuracy,
      color: position.precise ? PIN_COLOR.reliable : PIN_COLOR.approximate,
      fillOpacity: 0.1,
      weight: 1,
    }).addTo(map);

    // Aproximação padrão: raio grande, zoom ~15. Preciso: raio ~10m, zoom 18
    // (bloco/quadra). `flyTo` é animado; `setView` seria instantâneo mas
    // desorientaria quando a leitura precisa chega segundos depois.
    map.flyTo(center, position.precise ? 18 : 15, { duration: 0.6 });
  }, [position]);

  // Leitura inicial aproximada: barata em bateria, resolve em segundos. Não
  // pedir isso automaticamente deixaria a aba aberta no centro do Brasil até
  // o vendedor apertar o botão.
  useEffect(() => {
    if (!supported) return;
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
          precise: false,
        });
      },
      (err) => {
        // Só relata falha inicial quando é permissão negada — no timeout, o
        // botão de precisão ainda vai tentar do zero e é uma UX melhor que um
        // erro logo de cara.
        if (err.code === err.PERMISSION_DENIED) {
          setError("Permissão de localização negada. Habilite no navegador.");
        }
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 60_000 },
    );
  }, [supported]);

  const locatePrecisely = useCallback(() => {
    if (!supported) {
      setError("Este navegador não suporta geolocalização.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
          precise: true,
        });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Permissão de localização negada. Habilite no navegador."
            : "Não consegui pegar sua localização exata. Tente de novo em alguns segundos.",
        );
      },
      // `enableHighAccuracy: true` custa bateria (liga GPS) mas é o único
      // caminho pra chegar em ~10m de precisão. `maximumAge: 0` força leitura
      // nova — usar cache aqui derrota o botão.
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }, [supported]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Estou aqui</h2>
          <p className="text-xs text-muted-foreground">
            {position?.precise
              ? `Precisão de ~${Math.round(position.accuracy)} m.`
              : position
                ? `Aproximado (~${Math.round(position.accuracy)} m). Toque em "Estou aqui" para precisão.`
                : "Buscando sua localização…"}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={locatePrecisely}
          disabled={locating || !supported}
          className="shrink-0 gap-1.5"
        >
          {locating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LocateFixed className="size-4" />
          )}
          {locating ? "Localizando…" : "Estou aqui"}
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div
        ref={containerRef}
        // Altura fixa em vez de `h-full`: a aba fica dentro de um wrapper que
        // não define altura, e o Leaflet só desenha se o container tiver
        // dimensão medida.
        className={cn(
          "h-[420px] w-full overflow-hidden rounded-lg border",
          !supported && "opacity-50",
        )}
      />
    </div>
  );
}
