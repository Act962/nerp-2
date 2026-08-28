import { constructUrl } from "@/hooks/use-construct-url";
import type { ReceiptSaleData } from "./types";

// Campos da Organization que compõem o cabeçalho do cupom.
export type ReceiptOrgRow = {
  name?: string | null;
  tradeName?: string | null;
  document?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  phone?: string | null;
  logo?: string | null;
};

// Um só lugar montando o cabeçalho: o PDV e o preview do editor precisam
// mostrar exatamente a mesma identidade, senão o operador calibra o cupom com
// uma coisa e imprime outra.
export function toReceiptOrg(row: ReceiptOrgRow): ReceiptSaleData["org"] {
  const street = [row.address, row.addressNumber].filter(Boolean).join(", ");
  return {
    // Nome fantasia na frente: é o que o cliente reconhece no cupom.
    name: row.tradeName || row.name || "",
    document: row.document ?? null,
    address: street || null,
    phone: row.phone ?? null,
    // O logo é key do R2 (Configurações) ou base64 (criação da org) — as duas
    // passam pelo constructUrl.
    logoUrl: row.logo ? constructUrl(row.logo) : null,
  };
}
