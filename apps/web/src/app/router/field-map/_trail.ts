import type { z } from "zod";
import type { storeVisitSchema, trailPointSchema } from "./_schemas";

type TrailPoint = z.infer<typeof trailPointSchema>;
type StoreVisit = z.infer<typeof storeVisitSchema>;

export interface RawPoint {
  id: string;
  at: Date;
  latitude: number;
  longitude: number;
  storeId: string | null;
  storeName: string | null;
  city: string | null;
  state: string | null;
  /** Imagens desta captura. Uma ativação carrega de 1 a 3 fotos. */
  imageCount: number;
}

/** Fotos da mesma loja dentro desta janela são a MESMA parada. */
const SAME_STOP_MINUTES = 45;

/**
 * Acima disto o intervalo deixa de ser deslocamento.
 *
 * Três horas entre duas paradas não é "a caminho" — é almoço, fim de expediente
 * ou virada de dia. Contar isso como tempo de deslocamento inflaria o número e
 * ninguém conseguiria explicar de onde veio.
 */
const MAX_TRAVEL_MINUTES = 180;

/**
 * Colapsa fotos consecutivas numa parada.
 *
 * Cinco fotos no mesmo mercado em dez minutos são uma visita, não cinco pontos
 * no mapa. Fica no servidor de propósito: assim o contrato do cliente já é "as
 * paradas do dia", que é exatamente o que o check-in vai emitir depois — e a
 * tela não precisa saber que hoje isso é inferido de foto.
 */
export function collapseStops(points: RawPoint[]): TrailPoint[] {
  const stops: TrailPoint[] = [];

  for (const point of points) {
    const previous = stops[stops.length - 1];
    const sameStore =
      previous !== undefined &&
      previous.storeId !== null &&
      previous.storeId === point.storeId;
    const withinWindow =
      previous !== undefined &&
      point.at.getTime() - new Date(previous.endAt ?? previous.at).getTime() <=
        SAME_STOP_MINUTES * 60_000;

    if (previous && sameStore && withinWindow) {
      previous.endAt = point.at.toISOString();
      previous.activationCount += 1;
      previous.imageCount += point.imageCount;
      continue;
    }

    const gapMs = previous
      ? point.at.getTime() - new Date(previous.endAt ?? previous.at).getTime()
      : null;

    stops.push({
      id: `foto:${point.id}`,
      kind: "FOTO",
      at: point.at.toISOString(),
      endAt: null,
      latitude: point.latitude,
      longitude: point.longitude,
      storeId: point.storeId,
      storeName: point.storeName,
      city: point.city,
      state: point.state,
      activationCount: 1,
      imageCount: point.imageCount,
      gapFromPreviousMs: gapMs,
      // O servidor decide onde a linha quebra para que cliente e métrica nunca
      // discordem sobre o que é deslocamento e o que é intervalo.
      startsNewSegment: gapMs === null || gapMs > MAX_TRAVEL_MINUTES * 60_000,
    });
  }

  return stops;
}

export interface TrailSummary {
  /** Capturas registradas — cada uma é uma ação executada em loja. */
  activationCount: number;
  /** Imagens dentro dessas capturas. Sempre ≥ `activationCount`. */
  imageCount: number;
  storeCount: number;
  /** Soma da duração DENTRO das paradas (primeira à última foto da visita). */
  activeMs: number;
  /** Soma dos intervalos entre paradas que contam como deslocamento. */
  travelMs: number;
  /** Intervalos longos demais para serem deslocamento (almoço, virada de dia). */
  idleMs: number;
  /** Da primeira à última foto do período. */
  spanMs: number;
  /**
   * Paradas com uma ativação só — nelas o tempo em loja é ZERO medido, não zero
   * real. É o que impede o número de "tempo de ativação" de ser lido como
   * verdade absoluta.
   */
  unmeasuredStops: number;
  /** Paradas que renderam duração. O denominador honesto da média. */
  measuredStops: number;
  /**
   * Tempo médio POR VISITA MEDIDA.
   *
   * Dividir por todas as paradas puxaria a média para baixo com um monte de
   * zeros que só significam "não deu para medir" — e a média de tempo em loja é
   * exatamente o número que vira cobrança em cima de alguém.
   */
  avgVisitMs: number;
  /** O mesmo recorte, cliente a cliente. */
  byStore: StoreVisit[];
}

export function summarizeTrail(stops: TrailPoint[]): TrailSummary {
  let activeMs = 0;
  let travelMs = 0;
  let idleMs = 0;
  let activationCount = 0;
  let imageCount = 0;
  let unmeasuredStops = 0;
  let measuredStops = 0;

  const byStore = new Map<string, StoreVisit>();

  for (const stop of stops) {
    activationCount += stop.activationCount;
    imageCount += stop.imageCount;

    const stopMs = stop.endAt
      ? new Date(stop.endAt).getTime() - new Date(stop.at).getTime()
      : 0;
    if (stop.endAt) {
      activeMs += stopMs;
      measuredStops += 1;
    } else {
      unmeasuredStops += 1;
    }

    if (stop.storeId) {
      const current = byStore.get(stop.storeId) ?? {
        storeId: stop.storeId,
        storeName: stop.storeName,
        visits: 0,
        activationCount: 0,
        imageCount: 0,
        activeMs: 0,
        measuredVisits: 0,
        avgVisitMs: 0,
        firstAt: stop.at,
        lastAt: stop.at,
      };

      current.visits += 1;
      current.activationCount += stop.activationCount;
      current.imageCount += stop.imageCount;
      current.activeMs += stopMs;
      if (stop.endAt) current.measuredVisits += 1;
      // As paradas chegam em ordem cronológica, mas amarrar o resumo a essa
      // garantia externa é o tipo de coisa que quebra em silêncio no dia em que
      // alguém mudar o `orderBy`.
      if (stop.at < current.firstAt) current.firstAt = stop.at;
      const stopEnd = stop.endAt ?? stop.at;
      if (stopEnd > current.lastAt) current.lastAt = stopEnd;

      byStore.set(stop.storeId, current);
    }

    if (stop.gapFromPreviousMs === null) continue;
    if (stop.startsNewSegment) idleMs += stop.gapFromPreviousMs;
    else travelMs += stop.gapFromPreviousMs;
  }

  for (const visit of byStore.values()) {
    visit.avgVisitMs =
      visit.measuredVisits > 0
        ? Math.round(visit.activeMs / visit.measuredVisits)
        : 0;
  }

  const first = stops[0];
  const last = stops[stops.length - 1];
  const spanMs =
    first && last
      ? new Date(last.endAt ?? last.at).getTime() - new Date(first.at).getTime()
      : 0;

  return {
    activationCount,
    imageCount,
    storeCount: byStore.size,
    activeMs,
    travelMs,
    idleMs,
    spanMs,
    unmeasuredStops,
    measuredStops,
    avgVisitMs: measuredStops > 0 ? Math.round(activeMs / measuredStops) : 0,
    // Mais tempo em loja primeiro: é a ordem em que a coordenação lê, e o
    // desempate por nome mantém a lista estável entre dois carregamentos.
    byStore: [...byStore.values()].sort(
      (a, b) =>
        b.activeMs - a.activeMs ||
        b.activationCount - a.activationCount ||
        (a.storeName ?? "").localeCompare(b.storeName ?? "", "pt-BR"),
    ),
  };
}
