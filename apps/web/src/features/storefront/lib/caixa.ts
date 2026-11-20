/**
 * Quantidade em unidades dita em caixas, do jeito que o cliente fala:
 * 12 de 12 → "1 cx", 18 → "1 cx e meia", 6 → "meia cx", 15 → "1 cx + 3 un".
 * Sem caixa cadastrada (ou caixa de 1) não há o que dizer: devolve null.
 */
export function quantidadeEmCaixas(
  quantidade: number,
  unidadesPorCaixa: number | null | undefined,
): string | null {
  if (!unidadesPorCaixa || unidadesPorCaixa <= 1 || quantidade <= 0) return null;
  const caixas = Math.floor(quantidade / unidadesPorCaixa);
  const resto = quantidade % unidadesPorCaixa;
  const isMeia = unidadesPorCaixa % 2 === 0 && resto === unidadesPorCaixa / 2;
  if (resto === 0) return `${caixas} cx`;
  if (isMeia) return caixas === 0 ? "meia cx" : `${caixas} cx e meia`;
  if (caixas === 0) return null;
  return `${caixas} cx + ${resto} un`;
}

/** "Caixa com 12 un." — só quando o produto tem caixa cadastrada. */
export function rotuloDaCaixa(unidadesPorCaixa: number | null | undefined): string | null {
  return unidadesPorCaixa && unidadesPorCaixa > 1 ? `Caixa com ${unidadesPorCaixa} un.` : null;
}
