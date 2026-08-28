/**
 * Lucro, margem e markup a partir de custo e venda.
 *
 * Margem e markup respondem perguntas diferentes e são confundidos o tempo
 * todo: a margem divide o lucro pela VENDA (quanto do que entrou é lucro), o
 * markup divide pelo CUSTO (quanto se acrescentou em cima da compra). Custo 12
 * e venda 15 dão lucro 3, margem 20% e markup 25% — nunca o mesmo número.
 *
 * As razões são adimensionais, então serve tanto para reais quanto para
 * centavos (o Financeiro trabalha em centavos).
 */
export type PriceMetrics = {
  profit: number;
  /** Lucro ÷ venda, em %. `null` quando não há venda para servir de base. */
  marginPercent: number | null;
  /** Lucro ÷ custo, em %. `null` quando não há custo para servir de base. */
  markupPercent: number | null;
};

export function computePriceMetrics(cost: number, sale: number): PriceMetrics {
  const profit = sale - cost;
  return {
    profit,
    // Base zero não vira 0%: seria mentira. `null` deixa a UI mostrar "—" em
    // vez de um número inventado (ou de um Infinity vazando como "∞%").
    marginPercent: sale > 0 ? (profit / sale) * 100 : null,
    markupPercent: cost > 0 ? (profit / cost) * 100 : null,
  };
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

// --- Caminho inverso: da meta para o preço de venda ---
//
// O operador quer digitar "quero 25% de markup" e ver o preço se ajustar. Em
// todos os casos quem muda é o PREÇO DE VENDA: o custo é fato da compra, o
// preço é a decisão. Devolvem `null` quando a meta é impossível — aí a UI não
// mexe em nada em vez de gravar um preço absurdo.

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Venda = custo + lucro. Funciona mesmo com custo zero. */
export function salePriceFromProfit(cost: number, profit: number): number {
  return round2(cost + profit);
}

/**
 * Venda = custo ÷ (1 − margem). Margem de 100% ou mais é impossível: exigiria
 * preço infinito, porque a margem é fatia da própria venda.
 */
export function salePriceFromMargin(
  cost: number,
  marginPercent: number,
): number | null {
  if (marginPercent >= 100) return null;
  return round2(cost / (1 - marginPercent / 100));
}

/** Venda = custo × (1 + markup). Sem custo não há base — nada a calcular. */
export function salePriceFromMarkup(
  cost: number,
  markupPercent: number,
): number | null {
  if (cost <= 0) return null;
  return round2(cost * (1 + markupPercent / 100));
}
