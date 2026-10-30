// Contrato dos blocos do editor de cupom. Um template = lista ordenada de
// blocos (persistida em ReceiptTemplate.blocks) + tipo + papel. O MESMO array
// alimenta o preview do editor e a impressão real (renderer único).

export type ReceiptType = "FISCAL" | "NAO_FISCAL" | "ORCAMENTO";
export type ReceiptPaper = "MM80" | "MM58" | "A4";
export type BlockAlign = "left" | "center" | "right";
export type BlockSize = "sm" | "md" | "lg";

export type ReceiptBlock =
  | { id: string; kind: "logo"; align: BlockAlign; size: BlockSize }
  | {
      id: string;
      kind: "header";
      align: BlockAlign;
      showName: boolean;
      showDocument: boolean;
      showAddress: boolean;
      showPhone: boolean;
    }
  | {
      id: string;
      kind: "text";
      value: string;
      align: BlockAlign;
      bold: boolean;
      size: BlockSize;
    }
  | { id: string; kind: "items"; showSku: boolean; showUnitPrice: boolean }
  | {
      id: string;
      kind: "totals";
      showSubtotal: boolean;
      showDiscount: boolean;
      showPayments: boolean;
      showChange: boolean;
    }
  | {
      id: string;
      kind: "qr";
      source: "pix" | "nfce" | "custom";
      value: string;
      caption: string;
      size: BlockSize;
    }
  | { id: string; kind: "link"; label: string; url: string }
  | { id: string; kind: "divider"; style: "solid" | "dashed" }
  | { id: string; kind: "spacer" };

export type ReceiptBlockKind = ReceiptBlock["kind"];

export interface ReceiptTemplate {
  id: string;
  name: string;
  type: ReceiptType;
  paper: ReceiptPaper;
  blocks: ReceiptBlock[];
  isDefault: boolean;
}

// Dados de uma venda usados para resolver o template na impressão. Valores
// monetários em REAIS (o renderer formata em pt-BR).
export interface ReceiptSaleData {
  org: {
    name: string;
    document?: string | null;
    address?: string | null;
    phone?: string | null;
    logoUrl?: string | null;
  };
  sale: {
    number: number | string;
    date: string; // ISO
    sellerName?: string | null;
    customerName?: string | null;
  };
  items: {
    name: string;
    sku?: string | null;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  discount: number;
  total: number;
  payments: { method: string; amount: number }[];
  amountPaid?: number;
  change?: number;
  // valor livre para o QR do tipo "pix" (copia-e-cola) ou "nfce" (URL de consulta)
  pixCode?: string | null;
  nfceUrl?: string | null;
  // Presente quando a venda saiu com NFC-e autorizada: o cupom vira DANFCe e
  // ganha o bloco obrigatório (chave, protocolo, consumidor, QR Code).
  nfce?: DadosNfceCupom | null;
}

export interface DadosNfceCupom {
  chave: string;
  protocolo: string;
  numero: number;
  serie: number;
  autorizadoEm: string; // ISO
  homologacao: boolean;
  qrCodeUrl: string;
  consultaUrl: string | null;
  consumidor: string | null; // CPF/CNPJ só dígitos
  // Divisão I do DANFE: o emitente da NOTA (configuração fiscal), que pode
  // não ser o nome/CNPJ que a loja usa no cabeçalho do recibo.
  emitente: {
    razaoSocial: string;
    cnpj: string;
    inscricaoEstadual: string;
    endereco: string;
  };
  tributosAproximados: number | null; // reais, Lei 12.741/2012
}
