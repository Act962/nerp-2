"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  LocateFixed,
  MapPin,
  MapPinPlus,
  Route,
  SearchIcon,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type MapBounds,
  useDirectoryStores,
  useFieldTrail,
  usePromoterPositions,
  useImportOsmStores,
  useMapPromoters,
  useMapStores,
  useSearchOsmStores,
  useSearchPlaces,
  useStoreSuggestions,
} from "../hooks/use-mapa-de-campo";
import { PIN_COLOR, trailColor } from "../lib/leaflet-setup";
import { formatDuration } from "../lib/format-duration";
import type { PromoterTrail } from "../lib/trail-types";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useIsSuperAdmin } from "@/hooks/use-is-super-admin";
import { reverseGeocode } from "@/features/promotor/hooks/use-promotor";
import type { DirectoryPin, MapStorePin } from "./field-map-canvas";
import { type PickedPoint, NewStoreDialog } from "./new-store-dialog";
import {
  useAddRouteStop,
  useMyRoute,
  useRemoveRouteStop,
} from "@/features/promoter-route/hooks/use-promoter-route";
import { DirectoryLogoDialog } from "./directory-logo-dialog";
import { RoutePanel } from "./route-panel";
import { PromoterDetailSheet } from "./promoter-detail-sheet";
import { type StoreLogoTarget, StoreLogoDialog } from "./store-logo-dialog";

// `ssr: false` só é permitido dentro de um Client Component — mesma forma do
// `map-viewer.tsx` do mapa de PDV.
const FieldMapCanvas = dynamic(
  () => import("./field-map-canvas").then((mod) => mod.FieldMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[70vh] items-center justify-center rounded-lg border">
        <Spinner />
      </div>
    ),
  },
);

const LEGEND = [
  { color: PIN_COLOR.reliable, label: "Confirmada por 3+ fotos" },
  { color: PIN_COLOR.approximate, label: "Posição aproximada" },
  { color: PIN_COLOR.manual, label: "Ajustada manualmente" },
];

/** De quanto em quanto tempo a posição é reconsultada. */
const LOCATION_REFRESH_MS = 5 * 60 * 1000;

const ALL_PROMOTERS = "todos";

const today = () => dayjs().format("YYYY-MM-DD");

/** Margem além da tela, em fração do lado visível. */
const BOUNDS_PADDING = 0.35;
/** ~1 km. Arrastar menos que isto não deve virar consulta nova. */
const BOUNDS_STEP = 0.01;

/**
 * Arredonda a área para uma grade, com folga em volta.
 *
 * A área faz parte da chave da consulta, então sem isto cada arrastinho vira
 * requisição. A folga também faz o ponto logo além da borda já estar carregado
 * quando a tela chega nele. Se a caixa nova cabe dentro da que já está em uso,
 * mantém a antiga — a chave não muda e nada é refeito.
 */
function coarsen(bounds: MapBounds, current: MapBounds | null): MapBounds {
  const padLat = (bounds.north - bounds.south) * BOUNDS_PADDING;
  const padLng = (bounds.east - bounds.west) * BOUNDS_PADDING;
  // A folga é somada DEPOIS de o canvas já ter prendido o retângulo em
  // ±90/±180 — sem prender de novo aqui, ela estoura o limite e o servidor
  // recusa com um "input inválido" que não diz nada a ninguém.
  const clamp = (value: number, limit: number) =>
    Math.max(-limit, Math.min(limit, value));

  const next = {
    south: clamp(
      Math.floor((bounds.south - padLat) / BOUNDS_STEP) * BOUNDS_STEP,
      90,
    ),
    west: clamp(
      Math.floor((bounds.west - padLng) / BOUNDS_STEP) * BOUNDS_STEP,
      180,
    ),
    north: clamp(
      Math.ceil((bounds.north + padLat) / BOUNDS_STEP) * BOUNDS_STEP,
      90,
    ),
    east: clamp(
      Math.ceil((bounds.east + padLng) / BOUNDS_STEP) * BOUNDS_STEP,
      180,
    ),
  };

  if (
    current &&
    current.south <= bounds.south &&
    current.north >= bounds.north &&
    current.west <= bounds.west &&
    current.east >= bounds.east
  ) {
    return current;
  }
  return next;
}

export function MapaDeCampoContainer() {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [promoterId, setPromoterId] = useState(ALL_PROMOTERS);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<PickedPoint | null>(null);
  const [detailOf, setDetailOf] = useState<string | null>(null);
  const [focus, setFocus] = useState<PickedPoint | null>(null);
  const [query, setQuery] = useState("");
  const [logoTarget, setLogoTarget] = useState<StoreLogoTarget | null>(null);
  const [directoryLogoTarget, setDirectoryLogoTarget] =
    useState<DirectoryPin | null>(null);
  const isSuperAdmin = useIsSuperAdmin();
  const [routeOpen, setRouteOpen] = useState(false);
  // O mapa de campo abre já centrado em quem está olhando, e a posição se
  // mantém fresca sem deixar o GPS observando o dia inteiro.
  const me = useGeolocation({
    autoStartIfGranted: true,
    refreshMs: LOCATION_REFRESH_MS,
  });
  const [frameRouteToken, setFrameRouteToken] = useState(0);
  // Ligada por padrão: a primeira pergunta de quem abre o mapa de campo é
  // "cadê a equipe", e é o único dado da tela que não depende do período.
  const [showPresence, setShowPresence] = useState(true);

  const { stops: routeStops } = useMyRoute();
  const addRouteStop = useAddRouteStop();
  const removeRouteStop = useRemoveRouteStop();

  // Um índice alvo → parada, para o popup saber o rótulo e o botão saber o id
  // a remover sem uma consulta a mais.
  const routeStopByTarget = useMemo(
    () => new Map(routeStops.map((stop) => [stop.targetId, stop.id])),
    [routeStops],
  );
  const routeTargetIds = useMemo(
    () => new Set(routeStopByTarget.keys()),
    [routeStopByTarget],
  );

  const toggleRoute = (
    target: { kind: "STORE" | "DIRECTORY"; id: string },
    inRoute: boolean,
  ) => {
    if (inRoute) {
      const stopId = routeStopByTarget.get(target.id);
      if (stopId) removeRouteStop.mutate({ stopId });
      return;
    }
    addRouteStop.mutate(
      target.kind === "STORE"
        ? { storeId: target.id }
        : { directoryStoreId: target.id },
    );
  };

  // Duas cópias do mesmo retângulo, de propósito. A `ref` acompanha cada
  // arrasto sem re-renderizar e é lida quando alguém pede uma varredura; o
  // estado só acompanha depois que o mapa PARA, e é ele que alimenta a consulta
  // do catálogo. Sem essa separação, arrastar o mapa dispararia uma consulta por
  // quadro de animação.
  const boundsRef = useRef<MapBounds | null>(null);
  const [settledBounds, setSettledBounds] = useState<MapBounds | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBounds = useCallback((bounds: MapBounds) => {
    boundsRef.current = bounds;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(
      () => setSettledBounds((current) => coarsen(bounds, current)),
      400,
    );
  }, []);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  const searchOsm = useSearchOsmStores();
  const importOsm = useImportOsmStores();
  const searchPlaces = useSearchPlaces();

  // A varredura não devolve pinos: grava no catálogo e o mapa relê dali. Um
  // ponto efêmero não teria onde guardar logo nem como virar página pública.
  const findSupermarkets = (area = boundsRef.current) => {
    if (!area) return;
    searchOsm.mutate(area);
  };

  // Só no Enter/clique: a política do Nominatim proíbe busca a cada tecla, e
  // respeitá-la aqui é o que mantém de pé o geocode que roda em toda captura.
  const runPlaceSearch = () => {
    if (query.trim().length < 3) return;
    searchPlaces.mutate({ query: query.trim() });
  };

  const goToPlace = (place: { latitude: number; longitude: number }) => {
    setFocus({ latitude: place.latitude, longitude: place.longitude });
    searchPlaces.reset();
    // Ir até o lugar e já varrer em volta: é sempre o próximo passo de quem
    // procurou uma empresa que ainda não é cliente.
    findSupermarkets({
      south: place.latitude - 0.025,
      north: place.latitude + 0.025,
      west: place.longitude - 0.025,
      east: place.longitude + 0.025,
    });
  };

  /** `link` funde com o cliente que o servidor apontou como provável duplicata. */
  const registerDirectory = (pin: DirectoryPin, link: boolean) => {
    if (!pin.osmId) return;
    importOsm.mutate({
      items: [
        {
          osmId: pin.osmId,
          name: pin.name,
          latitude: pin.latitude,
          longitude: pin.longitude,
          address: pin.address,
          city: pin.city,
          state: pin.state,
          linkToStoreId: link ? pin.duplicateOfStoreId : null,
        },
      ],
    });
  };
  const handleEditLogo = useCallback((store: MapStorePin) => {
    setLogoTarget({
      id: store.id,
      name: store.name,
      coverImageKey: store.coverImageKey,
    });
  }, []);

  const { stores, offMap, isLoading } = useMapStores();
  const { points: directoryPins } = useDirectoryStores(settledBounds);
  const { promoters, canSeeAll } = useMapPromoters();
  const { positions } = usePromoterPositions(showPresence);

  // Cidade/UF de quem está olhando, resolvidas UMA vez quando a posição chega.
  // Elas são o critério de desempate para lojas que ainda não têm pino: sem
  // isso, "Carvalho" da cidade ao lado e "Carvalho" de outro estado chegariam
  // empatados na lista.
  const [myPlace, setMyPlace] = useState<{
    city?: string;
    state?: string;
  } | null>(null);
  useEffect(() => {
    if (!me.position || myPlace) return;
    let cancelled = false;
    reverseGeocode(me.position.latitude, me.position.longitude)
      .then((place) => {
        if (cancelled) return;
        setMyPlace({
          city: place.city ?? undefined,
          state: place.state ?? undefined,
        });
      })
      // Falhar aqui só custa o desempate; a ordem por distância continua de pé.
      .catch(() => setMyPlace({}));
    return () => {
      cancelled = true;
    };
  }, [me.position, myPlace]);

  const debouncedQuery = useDebouncedValue(query, 250);
  const suggestions = useStoreSuggestions(debouncedQuery, {
    latitude: me.position?.latitude,
    longitude: me.position?.longitude,
    city: myPlace?.city,
    state: myPlace?.state,
  });

  // Digitar uma data invertida é comum; em vez de devolver vazio sem explicação,
  // a consulta usa o intervalo na ordem certa.
  const [start, end] = from <= to ? [from, to] : [to, from];

  // O dia local vira instantes AQUI: o servidor roda em UTC e um "2026-08-02"
  // interpretado lá seria 21h do dia 1º para quem está em UTC-3.
  const range = useMemo(
    () => ({
      from: dayjs(`${start}T00:00:00`).toISOString(),
      to: dayjs(`${end}T23:59:59.999`).toISOString(),
    }),
    [start, end],
  );

  const {
    trails,
    truncated,
    isLoading: loadingTrail,
  } = useFieldTrail(
    range,
    promoterId === ALL_PROMOTERS ? undefined : [promoterId],
  );

  const setPeriod = (days: number) => {
    setFrom(
      dayjs()
        .subtract(days - 1, "day")
        .format("YYYY-MM-DD"),
    );
    setTo(today());
  };

  const detail: PromoterTrail | null =
    trails.find((trail) => trail.memberId === detailOf) ?? null;

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center rounded-lg border">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <InputGroup className="h-9 w-72">
            <InputGroupAddon>
              {searchPlaces.isPending ? <Spinner /> : <SearchIcon />}
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar empresa ou lugar..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  runPlaceSearch();
                }
              }}
            />
            {query && (
              <InputGroupAddon align="inline-end">
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => {
                    setQuery("");
                    searchPlaces.reset();
                  }}
                >
                  <X className="size-4" />
                </button>
              </InputGroupAddon>
            )}
          </InputGroup>

          {(suggestions.results.length > 0 || searchPlaces.isSuccess) && (
            <div className="absolute left-0 top-10 z-[500] w-96 max-w-[90vw] overflow-hidden rounded-lg border bg-popover shadow-md">
              {suggestions.results.length > 0 && (
                <ul className="max-h-72 overflow-y-auto">
                  {suggestions.results.map((item) => (
                    <li key={`${item.kind}:${item.id}`}>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            item.latitude === null ||
                            item.longitude === null
                          ) {
                            toast.info(
                              `${item.name} ainda não tem posição no mapa. A primeira foto tirada na porta fixa o pino.`,
                            );
                            return;
                          }
                          setFocus({
                            latitude: item.latitude,
                            longitude: item.longitude,
                          });
                          setQuery("");
                        }}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-accent"
                      >
                        <MapPin
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            item.kind === "STORE"
                              ? "text-emerald-600"
                              : "text-muted-foreground",
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {item.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {[item.city, item.state]
                              .filter(Boolean)
                              .join(" / ") || "Sem cidade"}
                            {item.kind === "DIRECTORY" && " · OpenStreetMap"}
                          </span>
                        </span>
                        {/* A distância é o motivo de a linha estar onde está —
                          mostrá-la evita a leitura de que a ordem é aleatória. */}
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {item.distanceM !== null
                            ? item.distanceM < 1000
                              ? `${item.distanceM} m`
                              : `${(item.distanceM / 1000).toFixed(1)} km`
                            : item.reason === "CIDADE"
                              ? "sua cidade"
                              : item.reason === "ESTADO"
                                ? "seu estado"
                                : "sem pino"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* O OpenStreetMap continua atrás do Enter: a política do
                Nominatim proíbe autocomplete por tecla, e a mesma cota atende
                o geocode de toda captura de foto em produção. */}
              {!searchPlaces.isSuccess && query.trim().length >= 3 && (
                <button
                  type="button"
                  onClick={runPlaceSearch}
                  disabled={searchPlaces.isPending}
                  className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  {searchPlaces.isPending ? (
                    <Spinner />
                  ) : (
                    <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  Buscar "{query.trim()}" no OpenStreetMap
                </button>
              )}
            </div>
          )}

          {searchPlaces.isSuccess && (
            <div className="absolute left-0 top-10 z-[500] w-96 max-w-[90vw] overflow-hidden rounded-lg border bg-popover shadow-md">
              {searchPlaces.data.places.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                  Nada encontrado no OpenStreetMap para "{query.trim()}".
                </p>
              ) : (
                <ul className="max-h-72 overflow-y-auto">
                  {searchPlaces.data.places.map((place) => (
                    <li key={place.osmId ?? place.label}>
                      <button
                        type="button"
                        onClick={() => goToPlace(place)}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-accent"
                      >
                        {place.isSupermarket ? (
                          <ShoppingCart className="mt-0.5 size-4 shrink-0 text-amber-600" />
                        ) : (
                          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {place.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {place.label}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-9 w-40"
            aria-label="Início do período"
          />
          <span className="text-sm text-muted-foreground">até</span>
          <Input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-9 w-40"
            aria-label="Fim do período"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPeriod(1)}
        >
          Hoje
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPeriod(7)}
        >
          7 dias
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPeriod(30)}
        >
          30 dias
        </Button>

        {canSeeAll && promoters.length > 1 && (
          <Select value={promoterId} onValueChange={setPromoterId}>
            <SelectTrigger className="h-9 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROMOTERS}>Todos os promotores</SelectItem>
              {promoters.map((promoter) => (
                <SelectItem key={promoter.memberId} value={promoter.memberId}>
                  {promoter.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          type="button"
          variant={picking ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setPicking((value) => !value)}
        >
          <MapPinPlus className="size-4" />
          {picking ? "Clique no mapa…" : "Novo cliente"}
        </Button>

        <Button
          type="button"
          variant={me.status === "on" ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          title={
            me.status === "denied"
              ? "Permissão de localização negada no navegador"
              : me.status === "on"
                ? "Voltar para a minha posição (atualiza a cada 5 min)"
                : "Ativar a minha localização"
          }
          onClick={() => {
            if (me.status === "on" && me.position) {
              setFocus(me.position);
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
          {/* O rótulo muda porque a ação muda: da primeira vez é conceder a
            permissão; depois é voltar para o próprio ponto. */}
          {me.status === "on" ? "Onde estou" : "Ativar localização"}
        </Button>

        {/* Separado do filtro de período de propósito: mostra onde a equipe
          está AGORA, mesmo com a tela exibindo a rota da semana passada. */}
        <Button
          type="button"
          variant={showPresence ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          title="Última posição conhecida de cada promotor"
          onClick={() => setShowPresence((value) => !value)}
        >
          <Users className="size-4" />
          Equipe
          {showPresence && positions.length > 0 ? ` (${positions.length})` : ""}
        </Button>

        <Button
          type="button"
          variant={routeStops.length > 0 ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setRouteOpen(true)}
        >
          <Route className="size-4" />
          Minha rota{routeStops.length > 0 ? ` (${routeStops.length})` : ""}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={searchOsm.isPending}
          onClick={() => findSupermarkets()}
        >
          {searchOsm.isPending ? (
            <Spinner />
          ) : (
            <ShoppingCart className="size-4" />
          )}
          Buscar supermercados aqui
        </Button>

        {loadingTrail && <Spinner />}

        {offMap.length > 0 && (
          <Badge
            variant="outline"
            className="ml-auto border-amber-300 text-amber-700"
          >
            {offMap.length} loja(s) ainda fora do mapa
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {LEGEND.map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
        {directoryPins.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: PIN_COLOR.approximate }}
            />
            {directoryPins.length} ponto(s) do OpenStreetMap
          </span>
        )}
        {/* A legenda é o caminho para o detalhe: quem quer os números de um
          promotor clica nele, que é onde a atenção já está. */}
        {trails.map((trail, index) => (
          <button
            key={trail.memberId}
            type="button"
            onClick={() => setDetailOf(trail.memberId)}
            className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent"
          >
            <span
              className="h-0.5 w-4 rounded-full"
              style={{ backgroundColor: trailColor(index) }}
            />
            <span className="font-medium">{trail.name}</span>
            <span className="text-muted-foreground">
              · {trail.storeCount} cliente(s) · {trail.activationCount}{" "}
              ativação(ões) · {formatDuration(trail.activeMs)} em loja
            </span>
          </button>
        ))}
      </div>

      {truncated && (
        <p className="text-xs text-amber-600">
          Há mais pontos do que cabe no mapa neste recorte — reduza o período ou
          filtre por promotor para ver tudo.
        </p>
      )}

      {/* No modo de cadastro o mapa aparece MESMO vazio: é justamente quando
        não há loja nenhuma que a pessoa mais precisa marcar a primeira. */}
      {stores.length === 0 &&
      trails.length === 0 &&
      directoryPins.length === 0 &&
      positions.length === 0 &&
      !picking ? (
        <div className="flex h-[70vh] flex-col items-center justify-center gap-2 rounded-lg border text-center">
          <p className="font-medium">Nada para mostrar neste período</p>
          <p className="max-w-md text-sm text-muted-foreground">
            A posição das lojas e o trajeto são montados a partir das fotos
            capturadas em campo. Fotos tiradas antes do registro de localização
            não aparecem aqui.
          </p>
          <Button
            type="button"
            className="mt-2 gap-1.5"
            onClick={() => setPicking(true)}
          >
            <MapPinPlus className="size-4" /> Marcar um cliente no mapa
          </Button>
        </div>
      ) : (
        <FieldMapCanvas
          stores={stores}
          trails={trails}
          picking={picking}
          focus={focus}
          onBoundsChange={handleBounds}
          onEditLogo={handleEditLogo}
          directoryPins={directoryPins}
          onRegisterDirectory={registerDirectory}
          canEditDirectoryLogo={isSuperAdmin}
          onEditDirectoryLogo={setDirectoryLogoTarget}
          routeStops={routeStops}
          routeTargetIds={routeTargetIds}
          onToggleRoute={toggleRoute}
          frameRouteToken={frameRouteToken}
          myLocation={me.position}
          promoterPositions={showPresence ? positions : []}
          onOpenPromoter={(memberId) => {
            // A presença ignora o período, o painel não. Sem este aviso, clicar
            // em quem não trabalhou no intervalo escolhido não faria nada — e
            // "nada" se parece com defeito.
            if (!trails.some((trail) => trail.memberId === memberId)) {
              toast.info(
                "Sem trajeto no período selecionado. Amplie as datas para ver a produtividade.",
              );
              return;
            }
            setDetailOf(memberId);
          }}
          onPick={(point) => {
            setPicked(point);
            setPicking(false);
          }}
        />
      )}
      <NewStoreDialog
        point={picked}
        open={picked !== null}
        onOpenChange={(open) => !open && setPicked(null)}
      />
      <PromoterDetailSheet
        trail={detail}
        open={detail !== null}
        onOpenChange={(open) => !open && setDetailOf(null)}
        onFocusStop={setFocus}
      />
      <StoreLogoDialog
        store={logoTarget}
        open={logoTarget !== null}
        onOpenChange={(open) => !open && setLogoTarget(null)}
      />
      <DirectoryLogoDialog
        pin={directoryLogoTarget}
        open={directoryLogoTarget !== null}
        onOpenChange={(open) => !open && setDirectoryLogoTarget(null)}
      />
      <RoutePanel
        open={routeOpen}
        onOpenChange={setRouteOpen}
        onFocusStop={setFocus}
        onFrameRoute={() => setFrameRouteToken((token) => token + 1)}
      />
    </div>
  );
}
