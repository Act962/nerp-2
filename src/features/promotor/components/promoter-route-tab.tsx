"use client";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import {
  useAddRouteStop,
  useMyRoute,
  useOptimizeRoute,
  useRemoveRouteStop,
  useReorderRoute,
  useRoutableStores,
} from "@/features/promoter-route/hooks/use-promoter-route";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  Crosshair,
  MapPin,
  Navigation,
  Plus,
  SearchIcon,
  Trash2,
} from "lucide-react";
import { useState } from "react";

/**
 * Link de navegação com a rota INTEIRA, na ordem.
 *
 * O Google Maps aceita paradas intermediárias por `waypoints`, então o promotor
 * sai do app já com o dia traçado em vez de ter que digitar endereço por
 * endereço. O limite de waypoints da URL é baixo; acima disso a navegação vai
 * até a última parada que cabe, e a tela avisa em vez de truncar calado.
 */
const MAX_WAYPOINTS = 9;

function navigationUrl(
  stops: { latitude: number; longitude: number }[],
): string {
  const points = stops.slice(0, MAX_WAYPOINTS + 1);
  const destination = points[points.length - 1];
  const waypoints = points.slice(0, -1);
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: "driving",
  });
  if (waypoints.length > 0) {
    params.set(
      "waypoints",
      waypoints.map((stop) => `${stop.latitude},${stop.longitude}`).join("|"),
    );
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function stopUrl(stop: { latitude: number; longitude: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}&travelmode=driving`;
}

/**
 * A rota do dia, montada pelo próprio promotor no celular.
 *
 * Antes disto a rota só existia no mapa de campo — uma tela de desktop atrás de
 * permissão de coordenação. Quem anda a rota não conseguia montá-la.
 *
 * Reordenar é por setas, não por arrastar: a lista vive dentro de uma página
 * que rola, e no celular o arrasto disputa com a rolagem justamente quando a
 * pessoa está de pé na calçada.
 */
export function PromoterRouteTab({
  onCaptureAt,
}: {
  onCaptureAt?: (store: { id: string; name: string }) => void;
}) {
  const { stops, totalMeters, isLoading } = useMyRoute();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const { stores, withoutPosition } = useRoutableStores(search);

  const addStop = useAddRouteStop();
  const removeStop = useRemoveRouteStop();
  const reorder = useReorderRoute();
  const optimize = useOptimizeRoute();

  const move = (index: number, delta: number) => {
    const next = [...stops];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate({ stopIds: next.map((stop) => stop.id) });
  };

  const suggest = () => {
    if (!navigator.geolocation) {
      optimize.mutate({});
      return;
    }
    // A posição é um bônus, não um requisito: negar não pode travar o botão.
    navigator.geolocation.getCurrentPosition(
      (position) =>
        optimize.mutate({
          startLatitude: position.coords.latitude,
          startLongitude: position.coords.longitude,
        }),
      () => optimize.mutate({}),
      { timeout: 5000 },
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {stops.length === 0
            ? "Monte a ordem das visitas de hoje."
            : `${stops.length} parada(s) · ${(totalMeters / 1000).toFixed(1)} km em linha reta`}
        </p>
        <Button
          type="button"
          size="sm"
          variant={adding ? "secondary" : "default"}
          className="shrink-0 gap-1.5"
          onClick={() => setAdding((value) => !value)}
        >
          <Plus className="size-4" />
          {adding ? "Fechar" : "Cliente"}
        </Button>
      </div>

      {adding && (
        <div className="space-y-2 rounded-lg border p-3">
          <InputGroup className="h-10">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar cliente..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </InputGroup>

          {stores.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Nenhum cliente com posição no mapa
              {search.trim() ? " para esta busca" : ""}.
            </p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {stores.map((store) => (
                <li key={store.id}>
                  <button
                    type="button"
                    disabled={store.inRoute || addStop.isPending}
                    onClick={() => addStop.mutate({ storeId: store.id })}
                    className="flex w-full items-center gap-2 rounded-md border p-2.5 text-left disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {store.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {[store.city, store.state]
                          .filter(Boolean)
                          .join(" / ") || "Sem cidade"}
                      </span>
                    </span>
                    {store.inRoute ? (
                      <Check className="size-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Plus className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Ausência explicada. Sem esta linha, o cliente que existe mas não
            tem pino simplesmente não está na busca, e parece cadastro perdido. */}
          {withoutPosition > 0 && (
            <p className="text-xs text-muted-foreground">
              {withoutPosition} cliente(s) ainda sem posição no mapa não
              aparecem aqui. A primeira foto tirada na porta fixa o pino.
            </p>
          )}
        </div>
      )}

      {stops.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border py-10 text-center">
          <MapPin className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">Sua rota está vazia</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Adicione os clientes que você vai visitar hoje. A ordem é sua — o
            app só sugere um caminho mais curto se você pedir.
          </p>
        </div>
      ) : (
        <ol className="space-y-1.5">
          {stops.map((stop, index) => (
            <li key={stop.id} className="rounded-lg border p-2.5">
              <div className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold tabular-nums text-primary-foreground">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {stop.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {stop.kind === "STORE"
                      ? "Cliente"
                      : "Ponto do OpenStreetMap"}
                  </span>
                </span>
                <div className="flex shrink-0 flex-col">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Subir ${stop.name}`}
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Descer ${stop.name}`}
                    disabled={index === stops.length - 1 || reorder.isPending}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-2 flex gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  asChild
                >
                  <a
                    href={stopUrl(stop)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation className="size-3.5" />
                    Ir
                  </a>
                </Button>
                {stop.kind === "STORE" && onCaptureAt && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() =>
                      onCaptureAt({ id: stop.targetId, name: stop.name })
                    }
                  >
                    <Camera className="size-3.5" />
                    Capturar
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-destructive"
                  aria-label={`Remover ${stop.name} da rota`}
                  onClick={() => removeStop.mutate({ stopId: stop.id })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {stops.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-1.5"
              disabled={optimize.isPending || stops.length < 3}
              onClick={suggest}
            >
              {optimize.isPending ? (
                <Spinner />
              ) : (
                <Crosshair className="size-4" />
              )}
              Melhor ordem
            </Button>
            <Button type="button" className="flex-1 gap-1.5" asChild>
              <a
                href={navigationUrl(stops)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Navigation className="size-4" />
                Traçar rota
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A distância é em linha reta entre as paradas, não quilometragem de
            rua — serve para comparar ordens.
            {stops.length > MAX_WAYPOINTS + 1 &&
              ` "Traçar rota" leva as ${MAX_WAYPOINTS + 1} primeiras paradas; o Google Maps não aceita mais que isso num link.`}
          </p>
        </div>
      )}
    </div>
  );
}
