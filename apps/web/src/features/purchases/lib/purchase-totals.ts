import { round2 } from "@/utils/pricing";

/**
 * Aritmética de dinheiro da entrada de nota.
 *
 * Módulo puro: sem Prisma, sem I/O. A regra que mais confunde está logo aqui:
 * `discount` de item é desconto em REAIS sobre a LINHA INTEIRA, não por
 * unidade. É como `Purchase.discount`/`shipping` já são (totais de documento) e
 * como a NF-e traz o `vDesc` de cada item.
 */

export { round2 };

export interface PurchaseLine {
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface PurchaseTotals {
  /** Soma bruta dos itens, antes de qualquer desconto — o `vProd` da NF-e. */
  subtotal: number;
  /** Só os descontos das linhas. */
  itemsDiscount: number;
  /**
   * Descontos de linha + desconto de cabeçalho — o `vDesc` da NF-e, e o que vai
   * para `Purchase.discount`. Guardar os dois somados é o que deixa a linha do
   * documento fechar sozinha: `subtotal - discount + shipping = total`. A parte
   * de cabeçalho continua derivável (`discount` menos a soma dos itens).
   */
  totalDiscount: number;
  total: number;
}

export function lineTotal(line: PurchaseLine): number {
  return round2(line.quantity * line.unitPrice - line.discount);
}

/**
 * O custo que vai para `Product.costPrice` e para `StockMovement.unitCost`.
 *
 * Frete e desconto de CABEÇALHO ficam de fora de propósito: sem rateio, eles
 * são custo financeiro da nota, não custo do produto. A consequência é
 * assumida e precisa estar escrita na tela — havendo frete, a soma dos custos
 * dos itens não fecha com o total a pagar.
 */
export function unitCost(line: PurchaseLine): number {
  if (line.quantity <= 0) return 0;
  return round2(lineTotal(line) / line.quantity);
}

export function purchaseTotals(args: {
  items: PurchaseLine[];
  discount: number;
  shipping: number;
}): PurchaseTotals {
  const subtotal = round2(
    args.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  );
  const itemsDiscount = round2(
    args.items.reduce((sum, item) => sum + item.discount, 0),
  );
  const totalDiscount = round2(itemsDiscount + args.discount);
  // Nunca negativo: desconto maior que a mercadoria é erro de digitação, e um
  // total negativo viraria uma conta a PAGAR com sinal trocado no Financeiro.
  const total = Math.max(0, round2(subtotal - totalDiscount + args.shipping));

  return { subtotal, itemsDiscount, totalDiscount, total };
}
