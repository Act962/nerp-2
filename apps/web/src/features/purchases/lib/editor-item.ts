/**
 * Uma linha do editor de entrada.
 *
 * `lineId` é o id da LINHA, `productId` o do produto: são coisas diferentes de
 * propósito. A mesma mercadoria pode vir duas vezes na mesma nota, em lotes ou
 * preços distintos, e cada uma precisa de identidade própria para o React e
 * para o foco. É a mesma modelagem do carrinho do PDV.
 */
export interface EditorItem {
  lineId: string;
  productId: string;
  name: string;
  code: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  /** Preço de venda aceito pelo operador. `null` = não mexer. */
  newSalePrice: number | null;
  /** Estado do produto ANTES desta nota — base da sugestão de preço. */
  product: {
    costPrice: number;
    salePrice: number;
    currentStock: number;
    trackStock: boolean;
  };
}
