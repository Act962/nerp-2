// Prato que veio do Catálogo Online não tem mesa: o `tableNumber` dele é
// "Pedido #N", e "Mesa Pedido #N" confundia a cozinha.
export function kitchenOrderLabel(order: {
  tableNumber: string;
  saleNumber: number | null;
}): string {
  if (order.saleNumber != null) return `Catálogo #${order.saleNumber}`;
  return `Mesa ${order.tableNumber}`;
}
