import "server-only";

import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export interface ChromePiece {
  layout: Prisma.JsonValue;
  background: Prisma.JsonValue | null;
}

export interface IndustryChrome {
  cover: ChromePiece | null;
  closing: ChromePiece | null;
}

// Capa e página final ATUAIS de uma indústria (padrões kind=COVER/CLOSING de
// /padroes). São a fonte da verdade: o book resolve a capa daqui na hora de
// renderizar, então trocar as logos no padrão reflete em todos os books —
// miniatura, editor e PDF — sem depender do snapshot copiado na geração.
export async function getIndustryChrome(
  organizationId: string,
  supplierId: string | null | undefined,
): Promise<IndustryChrome> {
  if (!supplierId) return { cover: null, closing: null };
  const templates = await prisma.bookPageTemplate.findMany({
    where: {
      organizationId,
      supplierId,
      kind: { in: ["COVER", "CLOSING"] },
    },
    select: { kind: true, layout: true, background: true },
  });
  const pick = (kind: "COVER" | "CLOSING"): ChromePiece | null => {
    const t = templates.find((x) => x.kind === kind);
    return t ? { layout: t.layout, background: t.background } : null;
  };
  return { cover: pick("COVER"), closing: pick("CLOSING") };
}

// Versão em lote pra listas de books: um único findMany pra todos os
// fornecedores, devolvendo Map<supplierId, IndustryChrome>.
export async function getIndustryChromeBatch(
  organizationId: string,
  supplierIds: string[],
): Promise<Map<string, IndustryChrome>> {
  const unique = [...new Set(supplierIds)];
  const result = new Map<string, IndustryChrome>();
  if (unique.length === 0) return result;

  const templates = await prisma.bookPageTemplate.findMany({
    where: {
      organizationId,
      supplierId: { in: unique },
      kind: { in: ["COVER", "CLOSING"] },
    },
    select: { supplierId: true, kind: true, layout: true, background: true },
  });

  for (const supplierId of unique) {
    const forSupplier = templates.filter((t) => t.supplierId === supplierId);
    const pick = (kind: "COVER" | "CLOSING"): ChromePiece | null => {
      const t = forSupplier.find((x) => x.kind === kind);
      return t ? { layout: t.layout, background: t.background } : null;
    };
    result.set(supplierId, { cover: pick("COVER"), closing: pick("CLOSING") });
  }
  return result;
}
