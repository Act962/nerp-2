import type { ReceiptSaleData } from "@/features/receipt-designer/lib/types";

export type TicketParaImprimir = {
  ticketId: string;
  tableNumber: string;
  createdAt: string;
  attendantName: string | null;
  customerName: string | null;
  saleNumber: number | null;
  subtotal: number;
  discount: number;
  total: number;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    notes: string | null;
    estimatedMinutes: number | null;
  }[];
};

/**
 * Traduz o ticket da cozinha para o contrato do cupom.
 *
 * O `number` do cupom é o número da venda quando o pedido nasceu do cardápio, e
 * a identificação do balcão quando não nasceu: pedido montado na mão não tem
 * venda, e imprimir "Venda 0" seria pior que imprimir "Mesa 4".
 */
export function ticketParaCupom(
  ticket: TicketParaImprimir,
  org: ReceiptSaleData["org"],
  urlDeAcompanhamento?: string | null,
): ReceiptSaleData {
  return {
    org,
    sale: {
      number: ticket.saleNumber ?? ticket.tableNumber,
      date: ticket.createdAt,
      sellerName: ticket.attendantName,
      customerName: ticket.customerName,
    },
    items: ticket.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
      notes: item.notes,
    })),
    subtotal: ticket.subtotal,
    discount: ticket.discount,
    total: ticket.total,
    payments: [],
    nfceUrl: urlDeAcompanhamento ?? null,
  };
}

/** Endereço que o cliente abre ao apontar a câmera para o cupom. */
export function urlDoTicket(ticketId: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/pedido-cliente/ticket/${ticketId}`;
}
