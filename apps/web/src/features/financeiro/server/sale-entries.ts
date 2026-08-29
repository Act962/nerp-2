import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  type BuildSaleEntriesArgs,
  buildSaleEntries,
  type SaleEntryCategory,
} from "../lib/sale-entries";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// Categorias que a venda usa no DRE. Criadas sob demanda para a integração não
// depender de alguém ter cadastrado o plano de contas antes — sem categoria, o
// lançamento cairia no balde "sem categoria" e o DRE perderia a separação
// entre receita e custo.
const CATEGORIAS: Record<
  SaleEntryCategory,
  { name: string; type: "REVENUE" | "COST" }
> = {
  REVENUE: { name: "Vendas", type: "REVENUE" },
  COST: { name: "Custo das mercadorias vendidas", type: "COST" },
};

async function ensureCategoryId(
  tx: Tx,
  organizationId: string,
  kind: SaleEntryCategory,
): Promise<string> {
  const { name, type } = CATEGORIAS[kind];
  const existing = await tx.paymentCategory.findFirst({
    where: { organizationId, name, type },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.paymentCategory.create({
    data: { organizationId, name, type },
    select: { id: true },
  });
  return created.id;
}

/**
 * Grava no Financeiro os lançamentos de uma venda concluída.
 *
 * Roda DENTRO da transação da venda: se qualquer parte falhar, a venda inteira
 * volta atrás e não sobra financeiro órfão.
 *
 * `skipDuplicates` cobre o reprocessamento: o único `(saleId, saleEntryKey)`
 * transforma a segunda tentativa em no-op em vez de duplicar receita.
 */
export async function createSaleFinanceEntries(
  tx: Tx,
  args: BuildSaleEntriesArgs & {
    organizationId: string;
    saleId: string;
    createdById: string | null;
  },
): Promise<number> {
  const drafts = buildSaleEntries(args);
  if (drafts.length === 0) return 0;

  const categoryIds = new Map<SaleEntryCategory, string>();
  for (const kind of new Set(drafts.map((draft) => draft.categoryKind))) {
    categoryIds.set(
      kind,
      await ensureCategoryId(tx, args.organizationId, kind),
    );
  }

  const result = await tx.paymentEntry.createMany({
    data: drafts.map((draft) => ({
      organizationId: args.organizationId,
      saleId: args.saleId,
      saleEntryKey: draft.saleEntryKey,
      categoryId: categoryIds.get(draft.categoryKind) ?? null,
      type: draft.type,
      status: draft.status,
      description: draft.description,
      amount: draft.amount,
      paidAmount: draft.paidAmount,
      dueDate: draft.dueDate,
      paidAt: draft.paidAt,
      competenceDate: draft.competenceDate,
      createdById: args.createdById,
    })),
    skipDuplicates: true,
  });

  return result.count;
}
