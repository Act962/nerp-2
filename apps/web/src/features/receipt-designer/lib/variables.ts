import { currencyFormatter } from "@/utils/currency-formatter";
import type { ReceiptSaleData } from "./types";

// Variáveis que o usuário pode digitar nos textos/legendas do template. São
// resolvidas na hora da impressão contra os dados da venda.
export function buildVariables(data: ReceiptSaleData): Record<string, string> {
  return {
    loja: data.org.name,
    documento: data.org.document ?? "",
    cliente: data.sale.customerName ?? "",
    vendedor: data.sale.sellerName ?? "",
    numero: String(data.sale.number),
    data: new Date(data.sale.date).toLocaleString("pt-BR"),
    subtotal: currencyFormatter(data.subtotal),
    desconto: currencyFormatter(data.discount),
    total: currencyFormatter(data.total),
    pago: currencyFormatter(data.amountPaid ?? data.total),
    troco: currencyFormatter(data.change ?? 0),
  };
}

// Troca {{chave}} pelos valores; chave desconhecida vira string vazia.
export function resolveVariables(
  text: string,
  vars: Record<string, string>,
): string {
  return text.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, key: string) =>
    key in vars ? vars[key] : "",
  );
}

export const AVAILABLE_VARIABLES = [
  "loja",
  "documento",
  "cliente",
  "vendedor",
  "numero",
  "data",
  "subtotal",
  "desconto",
  "total",
  "pago",
  "troco",
] as const;
