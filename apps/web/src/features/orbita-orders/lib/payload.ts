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
