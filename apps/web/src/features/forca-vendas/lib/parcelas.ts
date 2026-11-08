/**
 * Divide o total em parcelas pelos prazos da condição de pagamento. O resto
 * dos centavos vai para a última parcela, para a soma bater com o total.
 */
export function dividirEmParcelas(
  total: number,
  prazosDias: number[],
  faturadoEm: Date,
): Array<{ valor: number; vencimento: Date }> {
  const prazos = prazosDias.length > 0 ? prazosDias : [0];
  const totalCentavos = Math.round(total * 100);
  const base = Math.floor(totalCentavos / prazos.length);
  return prazos.map((dias, indice) => {
    const centavos =
      indice === prazos.length - 1
        ? totalCentavos - base * (prazos.length - 1)
        : base;
    const vencimento = new Date(faturadoEm);
    vencimento.setDate(vencimento.getDate() + dias);
    return { valor: centavos / 100, vencimento };
  });
}

export function descreverPrazos(prazosDias: number[]): string {
  if (
    prazosDias.length === 0 ||
    (prazosDias.length === 1 && prazosDias[0] === 0)
  ) {
    return "À vista";
  }
  return `${prazosDias.join("/")} dias`;
}
