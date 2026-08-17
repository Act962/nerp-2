"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import L from "leaflet";
import "leaflet.markercluster";
import { constructUrl } from "@/hooks/use-construct-url";
import { escapeHtml } from "@/lib/escape-html";
import { createLocationMarkers, createStorePin } from "../lib/pin-marker";
import { useCallback, useEffect, useRef } from "react";
import {
  BRAZIL_CENTER,
  BRAZIL_ZOOM,
  PIN_COLOR,
  TILE_ATTRIBUTION,
  TILE_URL,
  trailColor,
} from "../lib/leaflet-setup";
import { formatAgo } from "../lib/format-duration";
import type { PromoterTrail } from "../lib/trail-types";

export interface MapStorePin {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
  geoSource: "FOTO" | "MANUAL" | "IMPORTED" | "GEOCODED" | "OSM";
  geoSampleCount: number;
  coverImageKey: string | null;
  isReliable: boolean;
  public: {
    path: string;
    hasFloorPlan: boolean;
    hasPriceScan: boolean;
  } | null;
}

export interface RouteStopPin {
  id: string;
  targetId: string;
  name: string;
  latitude: number;
  longitude: number;
}

/** Mesma pele para `<button>` e `<a>`, para a fileira não ficar desalinhada. */
const POPUP_CONTROL =
  "display:inline-block;margin-top:6px;margin-right:4px;padding:3px 8px;border:1px solid currentColor;border-radius:6px;background:transparent;cursor:pointer;font:inherit;color:inherit;text-decoration:none";

// Links de verdade, não botões: clique do meio e "copiar link" passam a
// funcionar, e nenhum deles precisa de fiação no `popupopen`.
function popupLink(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="${POPUP_CONTROL}">${label}</a>`;
}

function pinColor(store: MapStorePin): string {
  if (store.geoSource === "MANUAL") return PIN_COLOR.manual;
  return store.isReliable ? PIN_COLOR.reliable : PIN_COLOR.approximate;
}

function popupHtml(store: MapStorePin, canEdit: boolean): string {
  const place = [store.city, store.state].filter(Boolean).join(" / ");
  const origin =
    store.geoSource === "MANUAL"
      ? "Posição ajustada manualmente"
      : store.geoSource === "IMPORTED"
        ? "Posição importada por planilha"
        : store.geoSource === "GEOCODED"
          ? "Posição pelo endereço cadastrado"
          : store.geoSource === "OSM"
            ? "Ponto do OpenStreetMap — confirme na primeira visita"
            : `Posição estimada por ${store.geoSampleCount} foto(s)`;

  const logoLabel = store.coverImageKey ? "Trocar logo" : "Adicionar logo";
  const face = store.public;

  return [
    `<strong>${escapeHtml(store.name)}</strong>`,
    store.address ? escapeHtml(store.address) : null,
    place ? escapeHtml(place) : null,
    `<span style="opacity:.7">${escapeHtml(origin)}</span>`,
    [
      canEdit
        ? `<button type="button" data-store-logo="1" style="${POPUP_CONTROL}">${logoLabel}</button>`
        : null,
      face?.hasFloorPlan
        ? popupLink(`${face.path}/mapa`, "Mapa da loja")
        : null,
      face?.hasPriceScan
        ? popupLink(`${face.path}/scan`, "App QR Preço")
        : null,
      face ? popupLink(face.path, "TradeGram") : null,
      `<button type="button" data-route="1" style="${POPUP_CONTROL}"></button>`,
    ]
      .filter(Boolean)
      .join(""),
  ]
    .filter(Boolean)
    .join("<br/>");
}

/**
 * Ponto do varejo conhecido — global, igual para toda organização.
 */
export interface DirectoryPin {
  id: string;
  name: string;
  osmId: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  suburb: string | null;
  city: string | null;
  state: string | null;
  companyName: string | null;
  logoKey: string | null;
  public: {
    path: string;
    hasFloorPlan: boolean;
    hasPriceScan: boolean;
  } | null;
  duplicateOfStoreId: string | null;
  duplicateOfStoreName: string | null;
  duplicateReason: string | null;
  duplicateDistanceM: number | null;
}

function directoryPopupHtml(pin: DirectoryPin, canEditLogo: boolean): string {
  const place = [pin.suburb, pin.city, pin.state].filter(Boolean).join(" — ");

  const face = pin.public;

  return [
    `<strong>${escapeHtml(pin.name)}</strong>`,
    pin.companyName ? escapeHtml(pin.companyName) : null,
    pin.address ? escapeHtml(pin.address) : null,
    place ? escapeHtml(place) : null,
    `<span style="opacity:.7">Ponto do OpenStreetMap<br/>Ainda não é seu cliente</span>`,
    pin.duplicateOfStoreName
      ? `<span style="color:#b45309">${escapeHtml(pin.duplicateReason ?? "Parece já cadastrado")}: <strong>${escapeHtml(pin.duplicateOfStoreName)}</strong>${pin.duplicateDistanceM !== null ? ` (${pin.duplicateDistanceM} m)` : ""}</span>`
      : null,
    [
      canEditLogo
        ? `<button type="button" data-dir-logo="1" style="${POPUP_CONTROL}">Trocar logo</button>`
        : null,
      face?.hasFloorPlan
        ? popupLink(`${face.path}/mapa`, "Mapa da loja")
        : null,
      face?.hasPriceScan
        ? popupLink(`${face.path}/scan`, "App QR Preço")
        : null,
      face ? popupLink(face.path, "TradeGram") : null,
      pin.osmId && pin.duplicateOfStoreId
        ? `<button type="button" data-dir-link="1" style="${POPUP_CONTROL}">É o mesmo cliente</button><button type="button" data-dir-create="1" style="${POPUP_CONTROL}">Cadastrar mesmo assim</button>`
        : pin.osmId
          ? `<button type="button" data-dir-create="1" style="${POPUP_CONTROL}">Cadastrar como cliente</button>`
          : null,
      `<button type="button" data-route="1" style="${POPUP_CONTROL}"></button>`,
    ]
      .filter(Boolean)
      .join(""),
  ]
    .filter(Boolean)
    .join("<br/>");
}

function stopIconHtml(
  trail: PromoterTrail,
  color: string,
  order: number,
): string {
  const initial = escapeHtml(
    trail.name.trim().slice(0, 1).toUpperCase() || "P",
  );
  const avatar = trail.image
    ? `<img src="${escapeHtml(trail.image)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/>`
    : `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:${color};color:#fff;font-size:12px;font-weight:700">${initial}</span>`;

  return `<span style="display:flex;align-items:center;gap:3px">
    <span style="width:30px;height:30px;border-radius:9999px;overflow:hidden;border:2px solid ${color};box-shadow:0 1px 3px rgba(0,0,0,.4);background:#fff;flex:0 0 auto">${avatar}</span>
    <span style="display:flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:9999px;background:${color};color:#fff;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)">${order}</span>
  </span>`;
}

export interface PromoterPosition {
  memberId: string;
  name: string;
  image: string | null;
  latitude: number;
  longitude: number;
  at: string;
  storeName: string | null;
  city: string | null;
  state: string | null;
}

/**
 * Raio, em metros, que o mapa mostra ao abrir já localizado.
 *
 * O enquadramento usa a geometria (`toBounds`), não um nível de zoom chutado:
 * assim são 50 m de verdade em qualquer tamanho de tela, e não "mais ou menos
 * isso num monitor de 1440px".
 */
const LOCATE_RADIUS_M = 50;

/** Fica FRIO quando a posição é velha demais para ser lida como "está lá". */
const PRESENCE_FRESH_MS = 3 * 60 * 60 * 1000;

function presenceIconHtml(position: PromoterPosition, color: string): string {
  const initial = escapeHtml(
    position.name.trim().slice(0, 1).toUpperCase() || "P",
  );
  const avatar = position.image
    ? `<img src="${escapeHtml(position.image)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/>`
    : `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:${color};color:#fff;font-size:14px;font-weight:700">${initial}</span>`;

  // O anel grosso e o halo distinguem "a pessoa" das paradas numeradas do
  // trajeto, que usam o mesmo avatar em tamanho menor.
  return `<span style="position:relative;display:block;width:38px;height:38px">
    <span style="position:absolute;inset:-6px;border-radius:9999px;background:${color};opacity:.18"></span>
    <span style="position:relative;display:block;width:38px;height:38px;border-radius:9999px;overflow:hidden;border:3px solid ${color};box-shadow:0 2px 6px rgba(0,0,0,.45);background:#fff">${avatar}</span>
  </span>`;
}

function presencePopupHtml(position: PromoterPosition, ago: string): string {
  const place =
    position.storeName ??
    [position.city, position.state].filter(Boolean).join(" · ");

  return [
    `<strong>${escapeHtml(position.name)}</strong>`,
    `Visto ${escapeHtml(ago)}`,
    place ? `em ${escapeHtml(place)}` : "",
    `<button type="button" data-promoter="1" style="${POPUP_CONTROL}">Ver produtividade</button>`,
    // A frase evita a leitura errada mais cara desta tela: o pino não é GPS ao
    // vivo, é o lugar da última foto.
    `<span style="color:#64748b">Posição da última foto capturada</span>`,
  ]
    .filter(Boolean)
    .join("<br/>");
}

function stopPopupHtml(
  promoter: string,
  stop: {
    at: string;
    endAt: string | null;
    storeName: string | null;
    activationCount: number;
    imageCount: number;
  },
  order: number,
): string {
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const period = stop.endAt
    ? `${time.format(new Date(stop.at))}–${time.format(new Date(stop.endAt))}`
    : time.format(new Date(stop.at));

  return [
    `<strong>${order}. ${escapeHtml(stop.storeName ?? "Sem loja")}</strong>`,
    escapeHtml(promoter),
    `${period} · ${stop.activationCount} ativação(ões) · ${stop.imageCount} foto(s)`,
  ].join("<br/>");
}

/**
 * O ÚNICO arquivo que importa `leaflet`.
 *
 * Fica atrás de `dynamic(..., { ssr: false })` porque o Leaflet mexe em `window`
 * já na avaliação do módulo — no servidor isso é `window is not defined`.
 */
export function FieldMapCanvas({
  stores,
  trails,
  picking,
  onPick,
  focus,
  onBoundsChange,
  onEditLogo,
  directoryPins,
  onRegisterDirectory,
  canEditDirectoryLogo,
  onEditDirectoryLogo,
  routeStops,
  routeTargetIds,
  onToggleRoute,
  frameRouteToken,
  myLocation,
  promoterPositions,
  onOpenPromoter,
}: {
  stores: MapStorePin[];
  trails: PromoterTrail[];
  /** Modo "clique para cadastrar cliente". */
  picking?: boolean;
  onPick?: (point: { latitude: number; longitude: number }) => void;
  /** Ponto a centralizar — vem do clique numa parada da lista lateral. */
  focus?: { latitude: number; longitude: number } | null;
  /** Área visível, para a busca de supermercados no OpenStreetMap. */
  onBoundsChange?: (bounds: {
    south: number;
    west: number;
    north: number;
    east: number;
  }) => void;
  onEditLogo?: (store: MapStorePin) => void;
  /** Supermercados do OSM ainda não cadastrados. */
  /** Varejo conhecido, global — não é carteira de ninguém. */
  directoryPins?: DirectoryPin[];
  onRegisterDirectory?: (pin: DirectoryPin, link: boolean) => void;
  /** Só a administração do TradeGram edita a logo do varejo global. */
  canEditDirectoryLogo?: boolean;
  onEditDirectoryLogo?: (pin: DirectoryPin) => void;
  /** Paradas da rota planejada, na ordem. */
  routeStops?: RouteStopPin[];
  /** Alvos já na rota. Lido por REF — ver comentário na implementação. */
  routeTargetIds?: Set<string>;
  onToggleRoute?: (
    target: { kind: "STORE" | "DIRECTORY"; id: string },
    inRoute: boolean,
  ) => void;
  /** Muda de valor para pedir o enquadramento da rota. */
  frameRouteToken?: number;
  /** Posição de quem está olhando — o ponto azul. */
  myLocation?: { latitude: number; longitude: number; accuracy: number } | null;
  /** Onde cada promotor foi visto por último. Independe do período do filtro. */
  promoterPositions?: PromoterPosition[];
  onOpenPromoter?: (memberId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const storeLayerRef = useRef<L.LayerGroup | null>(null);
  // Callbacks por ref: sem isto, trocar a função remontaria todos os pinos.
  const onEditLogoRef = useRef(onEditLogo);
  onEditLogoRef.current = onEditLogo;
  const onBoundsChangeRef = useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;
  const onRegisterDirectoryRef = useRef(onRegisterDirectory);
  onRegisterDirectoryRef.current = onRegisterDirectory;
  const onEditDirectoryLogoRef = useRef(onEditDirectoryLogo);
  onEditDirectoryLogoRef.current = onEditDirectoryLogo;
  /**
   * O que já foi pintado, amarrado à CAMADA que recebeu a pintura.
   *
   * Guardar só a assinatura não bastava: quando o mapa é recriado (StrictMode,
   * hot reload, remontagem), a camada nova nasce vazia mas a assinatura antiga
   * sobrevivia e dizia "já pintei" — e os pinos sumiam de vez. Comparando a
   * camada junto, camada nova nunca casa e a repintura acontece sozinha.
   */
  const paintedRef = useRef<{
    layer: L.LayerGroup;
    signature: string;
  } | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const meLayerRef = useRef<L.LayerGroup | null>(null);
  // Por REF, não por dependência: os efeitos de pino fazem `clearLayers()` e
  // recriam tudo quando suas deps mudam. Pôr o conjunto da rota nas deps
  // desmontaria centenas de marcadores a cada adição — o que se vê como
  // travamento, não como erro.
  const routeTargetIdsRef = useRef(routeTargetIds);
  routeTargetIdsRef.current = routeTargetIds;
  const onToggleRouteRef = useRef(onToggleRoute);
  onToggleRouteRef.current = onToggleRoute;
  const onOpenPromoterRef = useRef(onOpenPromoter);
  onOpenPromoterRef.current = onOpenPromoter;

  /** Escreve o rótulo do botão de rota depois que o popup abre. */
  // Identidade estável: a função só lê refs, e recriá-la a cada render faria os
  // efeitos que a usam redesenharem todos os pinos do mapa a cada digitação.
  const wireRouteButton = useCallback(
    (
      element: HTMLElement | undefined,
      target: { kind: "STORE" | "DIRECTORY"; id: string },
    ) => {
      const button = element?.querySelector<HTMLButtonElement>("[data-route]");
      if (!button) return;
      const inRoute = routeTargetIdsRef.current?.has(target.id) ?? false;
      button.textContent = inRoute
        ? "Remover da rota"
        : "Adicionar à minha rota";
      button.onclick = () => onToggleRouteRef.current?.(target, inRoute);
    },
    [],
  );
  const osmLayerRef = useRef<L.LayerGroup | null>(null);
  const trailLayerRef = useRef<L.LayerGroup | null>(null);
  const presenceLayerRef = useRef<L.LayerGroup | null>(null);
  /** Já centralizou em quem está olhando — os outros enquadramentos cedem. */
  const framedMeRef = useRef(false);
  /** Primeira pintura do trajeto; só ela cede a vez para a posição própria. */
  const firstTrailPaintRef = useRef(true);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: BRAZIL_CENTER,
      zoom: BRAZIL_ZOOM,
      // Canvas em vez de um nó de DOM por pino: com centenas de lojas a
      // diferença de fluidez ao arrastar o mapa é grande.
      preferCanvas: true,
    });
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(
      map,
    );

    mapRef.current = map;
    // Camadas de pino puro (loja, OSM, presença) viram clusters: com muitos
    // promotores/lojas o mapa virava sopa de avatares. `disableClusteringAtZoom`
    // deixa os avatares aparecerem individualmente ao dar zoom.
    const cluster = () =>
      L.markerClusterGroup({
        maxClusterRadius: 50,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 17,
      });
    storeLayerRef.current = cluster().addTo(map);
    osmLayerRef.current = cluster().addTo(map);
    trailLayerRef.current = L.layerGroup().addTo(map);
    // Depois do trajeto de propósito: a rota planejada desenha por cima.
    routeLayerRef.current = L.layerGroup().addTo(map);
    // Acima do trajeto: a pessoa importa mais que o rastro que ela deixou.
    presenceLayerRef.current = cluster().addTo(map);
    // Por último: "onde estou" é referência de leitura e fica acima de tudo.
    meLayerRef.current = L.layerGroup().addTo(map);

    // A área visível é o argumento da busca no OpenStreetMap; publicar a cada
    // `moveend` deixa o container sempre com o retângulo atual sem precisar
    // pedir o mapa emprestado.
    // Afastado o bastante, o mundo se repete na horizontal e o Leaflet devolve
    // longitude fora de -180/180 — que o schema do servidor recusa com um
    // "input inválido" que ninguém consegue interpretar. Prender aqui.
    const clamp = (value: number, limit: number) =>
      Math.max(-limit, Math.min(limit, value));

    const publishBounds = () => {
      const bounds = map.getBounds();
      onBoundsChangeRef.current?.({
        south: clamp(bounds.getSouth(), 90),
        west: clamp(bounds.getWest(), 180),
        north: clamp(bounds.getNorth(), 90),
        east: clamp(bounds.getEast(), 180),
      });
    };
    map.on("moveend", publishBounds);
    publishBounds();

    // O guard do ref acima não é zelo: o StrictMode do React roda o efeito duas
    // vezes e o segundo `L.map()` no mesmo nó lança "Map container is already
    // initialized".
    return () => {
      map.remove();
      mapRef.current = null;
      storeLayerRef.current = null;
      osmLayerRef.current = null;
      trailLayerRef.current = null;
      routeLayerRef.current = null;
      presenceLayerRef.current = null;
      meLayerRef.current = null;
    };
  }, []);

  // Modo de cadastro: o clique no mapa devolve o ponto. Registrado num efeito
  // próprio para o handler enxergar o `onPick` mais recente sem recriar o mapa.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const container = map.getContainer();
    container.style.cursor = picking ? "crosshair" : "";

    if (!picking || !onPick) return;
    const handler = (event: L.LeafletMouseEvent) => {
      onPick({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
      container.style.cursor = "";
    };
  }, [picking, onPick]);

  useEffect(() => {
    if (!focus) return;
    mapRef.current?.flyTo([focus.latitude, focus.longitude], 17, {
      duration: 0.6,
    });
  }, [focus]);

  // A sidebar do app colapsa e o container muda de largura sem o Leaflet saber
  // — sem isto ficam faixas cinzas onde deveria haver tile.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => mapRef.current?.invalidateSize());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = storeLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (stores.length === 0) return;

    for (const store of stores) {
      const marker = createStorePin({
        latitude: store.latitude,
        longitude: store.longitude,
        logoUrl: store.coverImageKey ? constructUrl(store.coverImageKey) : null,
        ringColor: pinColor(store),
      });

      marker.bindPopup(popupHtml(store, Boolean(onEditLogoRef.current)));
      // O botão vive dentro do HTML do popup, então só existe quando o popup
      // abre. Atribuir `onclick` (em vez de addEventListener) mantém um handler
      // só por reabertura.
      marker.on("popupopen", (event) => {
        const element = event.popup.getElement();
        const button =
          element?.querySelector<HTMLButtonElement>("[data-store-logo]");
        if (button) button.onclick = () => onEditLogoRef.current?.(store);
        wireRouteButton(element, { kind: "STORE", id: store.id });
      });
      marker.addTo(layer);
    }

    // Só enquadra pelas lojas quando NÃO há trajeto nem posição própria: com
    // trajeto quem manda é o dia do promotor, e com posição é onde a pessoa
    // está. Sem esta guarda os enquadramentos disputam e o mapa pula sozinho
    // conforme a ordem em que as respostas chegam — irreproduzível.
    if (trails.length === 0 && !framedMeRef.current) {
      map.fitBounds(
        L.latLngBounds(
          stores.map(
            (store) => [store.latitude, store.longitude] as [number, number],
          ),
        ),
        { padding: [40, 40], maxZoom: 15 },
      );
    }
  }, [stores, trails.length, wireRouteButton]);

  useEffect(() => {
    const layer = osmLayerRef.current;
    if (!layer) return;

    // Cada resposta traz um array NOVO, mesmo quando o conteúdo é idêntico —
    // e reconstruir a camada apaga e redesenha todos os pinos, o que se vê como
    // piscada. Só reconstrói quando algo que o pino desenha realmente mudou.
    const signature = [
      canEditDirectoryLogo ? "1" : "0",
      ...(directoryPins ?? []).map((pin) =>
        [
          pin.id,
          pin.logoKey ?? "",
          pin.public?.path ?? "",
          pin.public?.hasFloorPlan ? "1" : "0",
          pin.public?.hasPriceScan ? "1" : "0",
          pin.duplicateOfStoreId ?? "",
        ].join("|"),
      ),
    ].join("\n");

    if (
      paintedRef.current?.layer === layer &&
      paintedRef.current.signature === signature
    ) {
      return;
    }
    paintedRef.current = { layer, signature };

    layer.clearLayers();

    for (const pin of directoryPins ?? []) {
      // Mesma cor de "posição aproximada" dos clientes: um ponto do OSM É uma
      // posição aproximada, e ao virar cliente ele entra com geoSource OSM e
      // zero amostras, que resolve exatamente para esta cor. O pino não muda
      // ao ser cadastrado — só o popup.
      const marker = createStorePin({
        latitude: pin.latitude,
        longitude: pin.longitude,
        logoUrl: pin.logoKey ? constructUrl(pin.logoKey) : null,
        ringColor: PIN_COLOR.approximate,
      }).bindPopup(directoryPopupHtml(pin, Boolean(canEditDirectoryLogo)));

      marker.on("popupopen", (event) => {
        const element = event.popup.getElement();
        const create =
          element?.querySelector<HTMLButtonElement>("[data-dir-create]");
        if (create)
          create.onclick = () => onRegisterDirectoryRef.current?.(pin, false);
        const link =
          element?.querySelector<HTMLButtonElement>("[data-dir-link]");
        if (link)
          link.onclick = () => onRegisterDirectoryRef.current?.(pin, true);
        const logo =
          element?.querySelector<HTMLButtonElement>("[data-dir-logo]");
        if (logo) logo.onclick = () => onEditDirectoryLogoRef.current?.(pin);
        wireRouteButton(element, { kind: "DIRECTORY", id: pin.id });
      });

      marker.addTo(layer);
    }
  }, [directoryPins, canEditDirectoryLogo, wireRouteButton]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = trailLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (trails.length === 0) return;

    const all: [number, number][] = [];

    trails.forEach((trail, index) => {
      const color = trailColor(index);
      // Um traço por SEGMENTO, não um só do dia inteiro: quem decide onde
      // quebrar é o servidor (`startsNewSegment`), para a linha nunca ligar o
      // fim de um expediente ao começo do outro como se fosse deslocamento.
      const segments: [number, number][][] = [];
      for (const stop of trail.points) {
        const point: [number, number] = [stop.latitude, stop.longitude];
        all.push(point);
        if (stop.startsNewSegment || segments.length === 0)
          segments.push([point]);
        else segments[segments.length - 1].push(point);
      }

      for (const segment of segments) {
        if (segment.length < 2) continue;
        // Tracejado de propósito: são posições de FOTO, não GPS contínuo. Linha
        // cheia afirmaria um caminho percorrido que não foi medido.
        L.polyline(segment, {
          color,
          weight: 3,
          opacity: 0.75,
          dashArray: "6 6",
        }).addTo(layer);
      }

      trail.points.forEach((stop, order) => {
        L.marker([stop.latitude, stop.longitude], {
          icon: L.divIcon({
            className: "",
            html: stopIconHtml(trail, color, order + 1),
            // Avatar (30px) + número ao lado; a âncora fica no centro do
            // avatar, que é o ponto real da parada.
            iconSize: [52, 30],
            iconAnchor: [15, 15],
          }),
        })
          .bindPopup(stopPopupHtml(trail.name, stop, order + 1))
          .addTo(layer);
      });
    });

    if (all.length > 0) {
      // Na ABERTURA a posição de quem está olhando manda. Depois dela, não: se
      // a coordenação troca o período ou o promotor, ela está pedindo para ver
      // AQUELE trajeto, e deixar o mapa parado onde estava seria engolir o
      // pedido em silêncio.
      const openingWithOwnPosition =
        firstTrailPaintRef.current && framedMeRef.current;
      firstTrailPaintRef.current = false;
      if (!openingWithOwnPosition) {
        map.fitBounds(L.latLngBounds(all), { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [trails]);

  useEffect(() => {
    const layer = routeLayerRef.current;
    if (!layer) return;

    layer.clearLayers();
    const stops = routeStops ?? [];
    if (stops.length === 0) return;

    const path = stops.map(
      (stop) => [stop.latitude, stop.longitude] as [number, number],
    );

    if (path.length > 1) {
      // SÓLIDA, ao contrário do trajeto, que é tracejado. A diferença é
      // semântica: o tracejado diz "não medimos este caminho" — as posições
      // vêm de foto. A rota não foi medida, foi DECIDIDA, e sólido é o oposto
      // honesto de "estimativa".
      L.polyline(path, {
        color: PIN_COLOR.route,
        weight: 4,
        opacity: 0.9,
      }).addTo(layer);
    }

    stops.forEach((stop, index) => {
      L.marker([stop.latitude, stop.longitude], {
        icon: L.divIcon({
          className: "",
          html: `<span style="display:flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 5px;border-radius:9999px;background:${PIN_COLOR.route};color:#fff;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">${index + 1}</span>`,
          // Deslocado para cima e para a direita: a numeração acompanha o pino
          // sem cobri-lo, e a geometria do pino nunca é alterada por causa dela.
          iconSize: [24, 20],
          iconAnchor: [-8, 26],
        }),
        interactive: false,
      }).addTo(layer);
    });
  }, [routeStops]);

  // Onde cada promotor foi visto por último. Sem dependência do período: o
  // trajeto responde "por onde andou", isto responde "onde está".
  useEffect(() => {
    const layer = presenceLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    for (const position of promoterPositions ?? []) {
      const fresh =
        Date.now() - new Date(position.at).getTime() <= PRESENCE_FRESH_MS;
      const color = fresh ? PIN_COLOR.reliable : PIN_COLOR.approximate;

      L.marker([position.latitude, position.longitude], {
        icon: L.divIcon({
          className: "",
          html: presenceIconHtml(position, color),
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
        // Acima das paradas do trajeto, que ficam no offset padrão — senão a
        // pessoa some atrás do próprio rastro num dia de muitas paradas.
        zIndexOffset: 1000,
      })
        .bindPopup(presencePopupHtml(position, formatAgo(position.at)))
        .on("popupopen", (event) => {
          const button = event.popup
            .getElement()
            ?.querySelector<HTMLButtonElement>("[data-promoter]");
          if (!button) return;
          button.onclick = () => onOpenPromoterRef.current?.(position.memberId);
        })
        .addTo(layer);
    }
  }, [promoterPositions]);

  useEffect(() => {
    const layer = meLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!myLocation) return;
    for (const marker of createLocationMarkers(myLocation)) marker.addTo(layer);
  }, [myLocation]);

  // Enquadra a posição de quem está olhando — UMA vez, no primeiro fix.
  //
  // Repetir a cada atualização arrancaria o mapa da mão de quem estivesse
  // arrastando, a cada cinco minutos, sem nada na tela explicando o pulo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !myLocation || framedMeRef.current) return;
    framedMeRef.current = true;
    map.fitBounds(
      L.latLng(myLocation.latitude, myLocation.longitude).toBounds(
        LOCATE_RADIUS_M * 2,
      ),
      { maxZoom: 19 },
    );
  }, [myLocation]);

  // Enquadrar é um PEDIDO explícito, nunca automático: já há dois efeitos
  // disputando o enquadramento (lojas e trajeto) e um terceiro faria o mapa
  // pular sozinho enquanto a pessoa arrasta.
  useEffect(() => {
    if (!frameRouteToken) return;
    const stops = routeStops ?? [];
    if (stops.length === 0) return;
    mapRef.current?.fitBounds(
      L.latLngBounds(
        stops.map(
          (stop) => [stop.latitude, stop.longitude] as [number, number],
        ),
      ),
      { padding: [60, 60], maxZoom: 15 },
    );
  }, [frameRouteToken, routeStops]);

  return (
    // Altura explícita é obrigatória: sem ela o Leaflet renderiza um mapa de
    // 0px sem erro nenhum.
    <div
      ref={containerRef}
      className="field-map-shell h-[70vh] w-full rounded-lg border"
    />
  );
}
