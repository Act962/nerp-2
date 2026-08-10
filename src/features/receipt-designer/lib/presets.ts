import type { ReceiptBlock, ReceiptSaleData, ReceiptType } from "./types";

// Blocos padrão por tipo de cupom. Ids fixos aqui são ok (cada template é
// independente); novos blocos adicionados no editor recebem id via randomUUID.
const NAO_FISCAL: ReceiptBlock[] = [
  { id: "logo", kind: "logo", align: "center", size: "md" },
  {
    id: "header",
    kind: "header",
    align: "center",
    showName: true,
    showDocument: true,
    showAddress: true,
    showPhone: true,
  },
  { id: "div-1", kind: "divider", style: "dashed" },
  {
    id: "meta",
    kind: "text",
    value: "Venda {{numero}} · {{data}}\nCliente: {{cliente}}",
    align: "left",
    bold: false,
    size: "sm",
  },
  { id: "div-2", kind: "divider", style: "dashed" },
  { id: "items", kind: "items", showSku: false, showUnitPrice: true },
  { id: "div-3", kind: "divider", style: "dashed" },
  {
    id: "totals",
    kind: "totals",
    showSubtotal: true,
    showDiscount: true,
    showPayments: true,
    showChange: true,
  },
  { id: "div-4", kind: "divider", style: "dashed" },
  {
    id: "thanks",
    kind: "text",
    value: "Obrigado pela preferência!",
    align: "center",
    bold: true,
    size: "md",
  },
  {
    id: "footer",
    kind: "text",
    value: "Este documento não tem valor fiscal.",
    align: "center",
    bold: false,
    size: "sm",
  },
];

const FISCAL: ReceiptBlock[] = [
  { id: "logo", kind: "logo", align: "center", size: "md" },
  {
    id: "header",
    kind: "header",
    align: "center",
    showName: true,
    showDocument: true,
    showAddress: true,
    showPhone: false,
  },
  { id: "div-1", kind: "divider", style: "solid" },
  {
    id: "meta",
    kind: "text",
    value: "Cupom {{numero}} · {{data}}",
    align: "left",
    bold: false,
    size: "sm",
  },
  { id: "items", kind: "items", showSku: true, showUnitPrice: true },
  { id: "div-2", kind: "divider", style: "solid" },
  {
    id: "totals",
    kind: "totals",
    showSubtotal: true,
    showDiscount: true,
    showPayments: true,
    showChange: true,
  },
  {
    id: "qr",
    kind: "qr",
    source: "nfce",
    value: "",
    caption: "Consulte pela chave de acesso",
    size: "md",
  },
];

const ORCAMENTO: ReceiptBlock[] = [
  {
    id: "header",
    kind: "header",
    align: "left",
    showName: true,
    showDocument: true,
    showAddress: true,
    showPhone: true,
  },
  {
    id: "title",
    kind: "text",
    value: "ORÇAMENTO {{numero}}",
    align: "center",
    bold: true,
    size: "lg",
  },
  {
    id: "meta",
    kind: "text",
    value: "Data: {{data}}\nCliente: {{cliente}}",
    align: "left",
    bold: false,
    size: "md",
  },
  { id: "div-1", kind: "divider", style: "solid" },
  { id: "items", kind: "items", showSku: true, showUnitPrice: true },
  { id: "div-2", kind: "divider", style: "solid" },
  {
    id: "totals",
    kind: "totals",
    showSubtotal: true,
    showDiscount: true,
    showPayments: false,
    showChange: false,
  },
  {
    id: "valid",
    kind: "text",
    value: "Validade da proposta: 7 dias.",
    align: "left",
    bold: false,
    size: "sm",
  },
];

export const PRESET_BLOCKS: Record<ReceiptType, ReceiptBlock[]> = {
  NAO_FISCAL,
  FISCAL,
  ORCAMENTO,
};

// Clona os blocos de um preset (evita mutação do array compartilhado).
export function presetBlocks(type: ReceiptType): ReceiptBlock[] {
  return structuredClone(PRESET_BLOCKS[type]);
}

// Dados fictícios para o preview do editor.
export const SAMPLE_DATA: ReceiptSaleData = {
  org: {
    name: "Minha Loja LTDA",
    document: "12.345.678/0001-90",
    address: "Rua Exemplo, 100 - Centro",
    phone: "(11) 4002-8922",
    logoUrl: null,
  },
  sale: {
    number: 1024,
    date: new Date("2026-08-08T14:30:00Z").toISOString(),
    sellerName: "Ana",
    customerName: "João da Silva",
  },
  items: [
    {
      name: "Café torrado 500g",
      sku: "CAF-500",
      quantity: 2,
      unitPrice: 18.9,
      total: 37.8,
    },
    {
      name: "Açúcar 1kg",
      sku: "ACU-1",
      quantity: 1,
      unitPrice: 5.49,
      total: 5.49,
    },
    {
      name: "Filtro de papel 103",
      sku: "FIL-103",
      quantity: 3,
      unitPrice: 4.2,
      total: 12.6,
    },
  ],
  subtotal: 55.89,
  discount: 5.89,
  total: 50.0,
  payments: [
    { method: "PIX", amount: 30.0 },
    { method: "DINHEIRO", amount: 20.0 },
  ],
  amountPaid: 50.0,
  change: 0,
  pixCode: "00020126...5204000053039865802BR",
  nfceUrl: "https://nfce.exemplo.gov.br/consulta?chave=0000",
};
