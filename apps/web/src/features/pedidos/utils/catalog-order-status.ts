import { SaleOrigin, SaleStatus } from "@/generated/prisma/enums";

// Regras compartilhadas entre as procedures de pedido do Catálogo Online e a
// aba "Catálogo online" do /pedidos. Sem I/O: roda no servidor e no cliente.

export const ORBITA_OWNS_ORDER_MESSAGE =
  "Pedido em negociação no Órbita — só o Órbita confirma ou cancela.";

export const CATALOG_ORIGINS = [
  SaleOrigin.CATALOGO_APROVACAO,
  SaleOrigin.CATALOGO_ORBITA,
  SaleOrigin.CATALOGO_COZINHA,
  SaleOrigin.CATALOGO_MARKETPLACE,
] as const;

export type CatalogOrigin = (typeof CATALOG_ORIGINS)[number];

export function isCatalogOrigin(origin: SaleOrigin): origin is CatalogOrigin {
  return origin !== SaleOrigin.PDV;
}

export const CATALOG_STATUS_GROUPS = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
] as const;

export type CatalogStatusGroup = (typeof CATALOG_STATUS_GROUPS)[number];

// PROCESSING e COMPLETED são etapas depois da confirmação: para quem acompanha
// o pedido, continuam "confirmados". DRAFT não nasce no catálogo.
const STATUSES_BY_GROUP: Record<CatalogStatusGroup, SaleStatus[]> = {
  PENDING: [SaleStatus.PENDING_APPROVAL],
  CONFIRMED: [
    SaleStatus.CONFIRMED,
    SaleStatus.PROCESSING,
    SaleStatus.COMPLETED,
  ],
  CANCELLED: [SaleStatus.CANCELLED],
};

export function statusesOfGroup(group: CatalogStatusGroup): SaleStatus[] {
  return STATUSES_BY_GROUP[group];
}

export function groupOfStatus(status: SaleStatus): CatalogStatusGroup | null {
  for (const group of CATALOG_STATUS_GROUPS) {
    if (STATUSES_BY_GROUP[group].includes(status)) return group;
  }
  return null;
}

// Aprovar no PDV fecha a venda pendente como CANCELLED (a venda de verdade é
// a nova, feita no balcão). A nota é o que separa "virou venda" de "recusado".
const APPROVED_AT_PDV_PREFIX = "Aprovada no PDV por";
const REJECTED_PREFIX = "Recusado por";

export function approvedAtPdvNote(operatorName: string): string {
  return `${APPROVED_AT_PDV_PREFIX} ${operatorName} — venda gerada no balcão.`;
}

export function rejectedNote(operatorName: string, reason: string): string {
  return `${REJECTED_PREFIX} ${operatorName}: ${reason}`;
}

export function appendNote(notes: string | null, line: string): string {
  return notes ? `${notes}\n${line}` : line;
}

export type CatalogOrderClosure =
  | { kind: "APPROVED_AT_PDV" }
  | { kind: "REJECTED"; reason: string };

/** Lê da nota como um pedido cancelado foi fechado (a última linha vale). */
export function closureFromNotes(
  notes: string | null,
): CatalogOrderClosure | null {
  if (!notes) return null;
  const lines = notes.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.startsWith(APPROVED_AT_PDV_PREFIX)) {
      return { kind: "APPROVED_AT_PDV" };
    }
    if (line.startsWith(REJECTED_PREFIX)) {
      const separatorIndex = line.indexOf(": ");
      return {
        kind: "REJECTED",
        reason: separatorIndex >= 0 ? line.slice(separatorIndex + 2) : "",
      };
    }
  }
  return null;
}
