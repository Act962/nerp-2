import "server-only";

import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  type BuildPurchaseEntriesArgs,
  buildPurchaseEntries,
} from "../lib/purchase-entries";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// A categoria nasce com `excludeFromResult` ligado: comprar mercadoria é trocar
// caixa por ativo, e o resultado só é atingido na VENDA, via CMV — que
// `sale-entries.ts` já lança. Sem a flag, a mesma mercadoria apareceria como
// custo duas vezes no DRE. Criada sob demanda pelo mesmo motivo da venda: não
// depender de alguém ter montado o plano de contas antes.
const CATEGORIA_COMPRA = "Compra de mercadorias (estoque)";

async function ensurePurchaseCategoryId(
  tx: Tx,
  organizationId: string,
): Promise<string> {
  const existing = await tx.paymentCategory.findFirst({
    where: { organizationId, name: CATEGORIA_COMPRA },
    select: { id: true },
  });
  // Se a organização desligou `excludeFromResult` na mão, respeitamos: a
  // classificação do plano de contas é decisão dela, não nossa.
  if (existing) return existing.id;

  const created = await tx.paymentCategory.create({
    data: {
      organizationId,
      name: CATEGORIA_COMPRA,
      type: "COST",
      excludeFromResult: true,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * O contato do Financeiro correspondente ao fornecedor do ERP.
 *
 * São cadastros separados, ligados por `PaymentContact.supplierId`. Casar por
 * documento ou nome forkaria um contato novo assim que o fornecedor fosse
 * renomeado, partindo o histórico de contas a pagar em dois.
 */
async function ensureContactIdForSupplier(
  tx: Tx,
  organizationId: string,
  supplierId: string,
): Promise<string | null> {
  const existing = await tx.paymentContact.findFirst({
    where: { organizationId, supplierId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const supplier = await tx.supplier.findFirst({
    where: { id: supplierId, organizationId },
    select: { name: true, document: true, email: true, phone: true },
  });
  if (!supplier) return null;

  const created = await tx.paymentContact.create({
    data: {
      organizationId,
      supplierId,
      name: supplier.name,
      document: supplier.document,
      email: supplier.email,
      phone: supplier.phone,
      contactType: "SUPPLIER",
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Grava no Financeiro as contas a pagar de uma entrada de nota processada.
 *
 * Roda DENTRO da transação do processamento: se qualquer parte falhar, a nota
 * inteira volta atrás e não sobra passivo órfão.
 *
 * `skipDuplicates` cobre o reprocessamento: o único `(purchaseId,
 * purchaseEntryKey)` transforma a segunda tentativa em no-op em vez de
 * duplicar a dívida. É cinto junto com o suspensório do compare-and-swap que
 * trava o status da nota.
 */
export async function createPurchaseFinanceEntries(
  tx: Tx,
  args: BuildPurchaseEntriesArgs & {
    organizationId: string;
    purchaseId: string;
    supplierId: string | null;
    supplierName: string | null;
    createdById: string | null;
  },
): Promise<number> {
  const drafts = buildPurchaseEntries(args);
  if (drafts.length === 0) return 0;

  const categoryId = await ensurePurchaseCategoryId(tx, args.organizationId);
  const contactId = args.supplierId
    ? await ensureContactIdForSupplier(tx, args.organizationId, args.supplierId)
    : null;
  const installmentGroupId = drafts.length > 1 ? randomUUID() : null;

  const result = await tx.paymentEntry.createMany({
    data: drafts.map((draft) => ({
      organizationId: args.organizationId,
      purchaseId: args.purchaseId,
      purchaseEntryKey: draft.purchaseEntryKey,
      categoryId,
      contactId,
      type: "PAYABLE" as const,
      // Sempre pendente: a mercadoria chegou, o pagamento não saiu. Ver a
      // justificativa longa em `lib/purchase-entries.ts`.
      status: "PENDING" as const,
      description: draft.description,
      amount: draft.amount,
      paidAmount: 0,
      dueDate: draft.dueDate,
      competenceDate: draft.competenceDate,
      documentNumber: args.invoiceNumber,
      installmentTotal: draft.installmentTotal,
      installmentCurrent: draft.installmentCurrent,
      installmentGroupId,
      // Fornecedor não cadastrado não tem contato: o nome fica no lançamento
      // para a conta a pagar não virar um valor sem dono.
      notes: contactId ? null : args.supplierName,
      createdById: args.createdById,
    })),
    skipDuplicates: true,
  });

  return result.count;
}
