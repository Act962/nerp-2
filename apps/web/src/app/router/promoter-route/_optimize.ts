import { distanceMeters } from "@/lib/geo-distance";

export interface RoutePoint {
  id: string;
  latitude: number;
  longitude: number;
}

/** Teto de passadas do 2-opt. Bound explícito para o laço nunca ficar solto. */
const MAX_PASSES = 40;

/**
 * Comprimento do caminho ABERTO.
 *
 * Sem aresta de fechamento de propósito: o promotor não volta dirigindo até a
 * primeira loja no fim do dia. Somar o retorno inflaria o número e faria a
 * ordem sugerida otimizar uma volta que ninguém dá.
 */
export function pathLength(points: RoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distanceMeters(points[i - 1], points[i]);
  }
  return total;
}

function nearestNeighbour(points: RoutePoint[]): RoutePoint[] {
  const remaining = [...points];
  const order: RoutePoint[] = [];
  let current = remaining.shift();
  while (current) {
    order.push(current);
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i += 1) {
      const d = distanceMeters(current, remaining[i]);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }
    current = bestIndex >= 0 ? remaining.splice(bestIndex, 1)[0] : undefined;
  }
  return order;
}

/**
 * 2-opt: inverte um trecho quando isso encurta o caminho.
 *
 * `pinFirst` protege o índice 0 — quando o promotor pede "começar de onde
 * estou", mover a primeira parada faria o botão não fazer nada, com números que
 * continuam plausíveis. É o tipo de erro que nunca aparece como erro.
 */
function twoOpt(order: RoutePoint[], pinFirst: boolean): RoutePoint[] {
  const result = [...order];
  const start = pinFirst ? 1 : 0;
  let improved = true;
  let passes = 0;

  while (improved && passes < MAX_PASSES) {
    improved = false;
    passes += 1;
    for (let i = start; i < result.length - 1; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        const candidate = [
          ...result.slice(0, i),
          ...result.slice(i, j + 1).reverse(),
          ...result.slice(j + 1),
        ];
        if (pathLength(candidate) < pathLength(result) - 1) {
          result.splice(0, result.length, ...candidate);
          improved = true;
        }
      }
    }
  }
  return result;
}

export interface OptimizeResult {
  order: RoutePoint[];
  beforeMeters: number;
  afterMeters: number;
}

/**
 * Ordena as paradas por vizinho-mais-próximo e refina com 2-opt.
 *
 * Distância em linha reta, não por ruas: a ordem acerta quase sempre dentro de
 * uma cidade, e evita depender de um terceiro provedor externo no caminho
 * crítico — já há dois (Nominatim e Overpass) e um bloqueio derruba a captura.
 */
export function optimizeRoute(
  points: RoutePoint[],
  start?: { latitude: number; longitude: number },
): OptimizeResult {
  const beforeMeters = pathLength(points);
  if (points.length < 3) {
    return { order: points, beforeMeters, afterMeters: beforeMeters };
  }

  let seeded = points;
  if (start) {
    // Começar pela parada mais próxima de onde a pessoa está — e mantê-la presa.
    const closest = [...points].sort(
      (a, b) => distanceMeters(start, a) - distanceMeters(start, b),
    )[0];
    seeded = [closest, ...points.filter((p) => p.id !== closest.id)];
  }

  const greedy = nearestNeighbour(seeded);
  const order = twoOpt(greedy, Boolean(start));

  return { order, beforeMeters, afterMeters: pathLength(order) };
}
