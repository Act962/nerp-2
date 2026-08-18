import type { HeatMetric } from "./map-filter-store";
import type { SceneObject } from "./types";

// Escala de intensidade do choropleth — do mais claro (quantil baixo) ao mais
// intenso (quantil alto). 5 degraus bastam pra leitura visual rápida no mapa.
const HEAT_COLORS = [
  "#dbeafe",
  "#93c5fd",
  "#3b82f6",
  "#1d4ed8",
  "#1e3a8a",
];

export function getHeatMetricValue(
  object: SceneObject,
  metric: HeatMetric,
): number | null {
  switch (metric) {
    case "AVG_SALES":
      return object.avgSalesAmount;
    case "NEGOTIATED_VALUE":
      return object.activeNegotiation?.amount ?? null;
    case "ACTION_VALUE":
      return object.revenuePotential;
    case "NONE":
      return null;
  }
}

// Escala por quantil (não por valor absoluto): cada espaço é comparado só
// contra o conjunto visível no momento, então a paleta sempre usa a faixa
// inteira de cores mesmo quando os valores da loja são todos baixos ou altos.
export function buildQuantileColorScale(
  values: number[],
): (value: number) => string {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return () => HEAT_COLORS[0];
  }
  return (value: number) => {
    let rank = 0;
    for (const candidate of sorted) {
      if (candidate <= value) rank++;
      else break;
    }
    const quantile = rank / sorted.length;
    const bucket = Math.min(
      HEAT_COLORS.length - 1,
      Math.floor(quantile * HEAT_COLORS.length),
    );
    return HEAT_COLORS[bucket];
  };
}
