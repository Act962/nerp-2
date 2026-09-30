/**
 * Corpo do pedido que o NERP entrega ao Órbita
 * (`POST /api/integrations/nerp/orders`). O contrato é compartilhado com o
 * nasaex-wey (`docs/nerp-catalog-orbita.md`): mudar um campo aqui é mudar a
 * API do outro lado.
 */

export type OrbitaOrderDelivery = {
  method: string | null;
  address: string | null;
  notes: string | null;
};

export type OrbitaOrderItem = {
  productId: string;
  name: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  imageUrl: string | null;
  /**
   * Preço de tabela, só como referência para o consultor. Vem em pedido de
   * orçamento, onde `unitPrice`/`total` chegam 0 — o valor é combinado lá.
   */
  referenceUnitPrice: number | null;
};

export type OrbitaOrderPayload = {
  nerpSaleId: string;
  saleNumber: number;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
    email: string | null;
    document: string | null;
  };
  delivery: OrbitaOrderDelivery;
  items: OrbitaOrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  catalogUrl: string | null;
  /**
   * Pedido de orçamento: o cliente mandou só a lista, sem preço. O consultor
   * combina o valor e o devolve por `catalogOrder.updateQuote` antes de cobrar.
   */
  quote: boolean;
};

export type OrbitaOrderResponse = {
  orderToken: string;
  portalUrl: string;
  whatsappUrl: string | null;
};

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
