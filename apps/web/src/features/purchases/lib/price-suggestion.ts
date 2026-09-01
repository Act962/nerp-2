import { computePriceMetrics, salePriceFromMargin } from "@/utils/pricing";

/**
 * Preço de venda sugerido quando o custo de compra muda: preserva a margem que
 * o produto já pratica.
 *
 * Preservar margem e preservar markup dão exatamente o MESMO número — as duas
 * formulações se reduzem a escalar o preço pela razão dos custos
 * (`P' = P × C'/C`). Passamos pela margem porque reaproveita
 * `salePriceFromMargin`, que já é testado, e porque é o vocabulário do varejo.
 *
 * `null` = não há o que sugerir, e a tela não deve destacar a linha:
 * - sem custo ou sem preço anteriores, não existe margem de referência;
 * - custo novo igual ao antigo: repetir o preço que já está lá é só ruído;
 * - margem de 100% ou mais é impossível de reproduzir (exigiria preço infinito).
 *
 * Margem negativa (produto vendido abaixo do custo) é preservada de propósito:
 * a decisão de vender no prejuízo é de quem precifica, não nossa. Cabe à tela
 * sinalizar, não a este módulo esconder.
 */
export function suggestSalePrice(args: {
  previousCost: number;
  previousSalePrice: number;
  newCost: number;
}): number | null {
  const { previousCost, previousSalePrice, newCost } = args;

  if (previousCost <= 0 || previousSalePrice <= 0) return null;
  if (newCost <= 0) return null;
  if (newCost === previousCost) return null;

  const { marginPercent } = computePriceMetrics(
    previousCost,
    previousSalePrice,
  );
  if (marginPercent === null) return null;

  return salePriceFromMargin(newCost, marginPercent);
}
