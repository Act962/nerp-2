/**
 * Regras da contagem de inventário. Módulo puro — sem Prisma, sem I/O.
 */

export interface CountLine {
  productId: string;
  productName: string;
  /** O que o operador contou na prateleira. */
  countedQuantity: number;
  /** Saldo do sistema CONGELADO no instante da contagem. */
  systemQuantity: number;
  /** Saldo do sistema AGORA, na hora de aplicar. */
  currentStock: number;
}

export interface AdjustmentPlanItem {
  productId: string;
  productName: string;
  /** Divergência OBSERVADA: contado − sistema no momento da contagem. */
  divergence: number;
  currentStock: number;
  newStock: number;
  /**
   * O estoque mexeu entre contar e aplicar (venda, entrada). Não impede o
   * ajuste, mas é o que a tela destaca para o conferente decidir se recontá-lo.
   */
  driftedSinceCount: boolean;
}

/**
 * Traduz a contagem em ajustes.
 *
 * Aplica a DIFERENÇA observada sobre o saldo atual, em vez de simplesmente
 * gravar a quantidade contada. Parece o mesmo, e não é: se o produto foi
 * vendido entre a contagem e a aplicação, gravar o contado ressuscitaria as
 * unidades vendidas e apagaria a venda do saldo. A diferença é o que o
 * operador de fato observou; o resto do movimento continua valendo.
 *
 * Linhas sem divergência não viram ajuste — movimento de zero só sujaria o
 * histórico.
 */
export function buildAdjustmentPlan(lines: CountLine[]): AdjustmentPlanItem[] {
  const plan: AdjustmentPlanItem[] = [];
  for (const line of lines) {
    const divergence = line.countedQuantity - line.systemQuantity;
    if (divergence === 0) continue;
    plan.push({
      productId: line.productId,
      productName: line.productName,
      divergence,
      currentStock: line.currentStock,
      newStock: line.currentStock + divergence,
      driftedSinceCount: line.currentStock !== line.systemQuantity,
    });
  }
  return plan;
}

export interface CountSummary {
  /** Produtos contados na sessão. */
  counted: number;
  /** Quantos divergiram do sistema. */
  divergent: number;
  /** Sobras: contado maior que o sistema. */
  positive: number;
  /** Faltas: contado menor que o sistema. */
  negative: number;
  /** Soma das divergências em unidades (positivas menos negativas). */
  netUnits: number;
  /** Linhas cujo saldo mudou entre contar e aplicar. */
  drifted: number;
}

export function summarizeCount(lines: CountLine[]): CountSummary {
  const summary: CountSummary = {
    counted: lines.length,
    divergent: 0,
    positive: 0,
    negative: 0,
    netUnits: 0,
    drifted: 0,
  };

  for (const line of lines) {
    const divergence = line.countedQuantity - line.systemQuantity;
    if (line.currentStock !== line.systemQuantity) summary.drifted++;
    if (divergence === 0) continue;
    summary.divergent++;
    summary.netUnits += divergence;
    if (divergence > 0) summary.positive++;
    else summary.negative++;
  }

  return summary;
}
