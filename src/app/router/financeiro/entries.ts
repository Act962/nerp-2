import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Prisma } from "@/generated/prisma/client";
import type { FinancialEntryStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { randomUUID } from "node:crypto";
import { z } from "zod";

// Subconjunto do objeto `errors` que os helpers deste arquivo lançam.
type FinanceErrors = { NOT_FOUND: (opts: { message: string }) => Error };

// Lançamentos a pagar/receber. Valores em CENTAVOS (Int).
const p = base.use(requireAuthMiddleware).use(requireOrgMiddleware);

const entryType = z.enum(["RECEIVABLE", "PAYABLE"]);
const entryStatus = z.enum([
  "PENDING_APPROVAL",
  "PENDING",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "CANCELLED",
]);

const entryWithRelations = {
  category: { select: { name: true, color: true } },
  contact: { select: { name: true } },
  account: { select: { name: true } },
  costCenter: { select: { name: true } },
} as const;

type EntryRow = Prisma.PaymentEntryGetPayload<{
  include: typeof entryWithRelations;
}>;

function serialize(e: EntryRow) {
  const open = e.status !== "PAID" && e.status !== "CANCELLED";
  const overdue = open && e.dueDate < new Date() && e.paidAmount < e.amount;
  return {
    id: e.id,
    type: e.type,
    status: e.status,
    overdue,
    description: e.description,
    amount: e.amount,
    paidAmount: e.paidAmount,
    remaining: Math.max(0, e.amount - e.paidAmount),
    dueDate: e.dueDate.toISOString(),
    paidAt: e.paidAt?.toISOString() ?? null,
    competenceDate: e.competenceDate?.toISOString() ?? null,
    documentNumber: e.documentNumber,
    notes: e.notes,
    categoryId: e.categoryId,
    categoryName: e.category?.name ?? null,
    categoryColor: e.category?.color ?? null,
    contactId: e.contactId,
    contactName: e.contact?.name ?? null,
    accountId: e.accountId,
    accountName: e.account?.name ?? null,
    costCenterId: e.costCenterId,
    costCenterName: e.costCenter?.name ?? null,
    installmentTotal: e.installmentTotal,
    installmentCurrent: e.installmentCurrent,
    installmentGroupId: e.installmentGroupId,
    isRecurring: e.isRecurring,
    recurrenceType: e.recurrenceType,
    createdAt: e.createdAt.toISOString(),
  };
}

const entryOutput = z.object({
  id: z.string(),
  type: entryType,
  status: entryStatus,
  overdue: z.boolean(),
  description: z.string(),
  amount: z.number().int(),
  paidAmount: z.number().int(),
  remaining: z.number().int(),
  dueDate: z.string(),
  paidAt: z.string().nullable(),
  competenceDate: z.string().nullable(),
  documentNumber: z.string().nullable(),
  notes: z.string().nullable(),
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
  categoryColor: z.string().nullable(),
  contactId: z.string().nullable(),
  contactName: z.string().nullable(),
  accountId: z.string().nullable(),
  accountName: z.string().nullable(),
  costCenterId: z.string().nullable(),
  costCenterName: z.string().nullable(),
  installmentTotal: z.number().int().nullable(),
  installmentCurrent: z.number().int().nullable(),
  installmentGroupId: z.string().nullable(),
  isRecurring: z.boolean(),
  recurrenceType: z.string().nullable(),
  createdAt: z.string(),
});

export const listEntries = p
  .input(
    z.object({
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20),
      type: entryType.optional(),
      status: entryStatus.optional(),
      onlyOverdue: z.boolean().optional(),
      contactId: z.string().optional(),
      categoryId: z.string().optional(),
      accountId: z.string().optional(),
      search: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  )
  .output(
    z.object({
      entries: z.array(entryOutput),
      nextCursor: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const where = {
      organizationId: context.org.id,
      ...(input.type ? { type: input.type } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.contactId ? { contactId: input.contactId } : {}),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.accountId ? { accountId: input.accountId } : {}),
      ...(input.onlyOverdue
        ? {
            status: {
              in: ["PENDING", "PARTIAL"] as FinancialEntryStatus[],
            },
            dueDate: { lt: new Date() },
          }
        : {}),
      ...(input.search
        ? {
            description: {
              contains: input.search,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(input.from || input.to
        ? {
            dueDate: {
              ...(input.from ? { gte: new Date(input.from) } : {}),
              ...(input.to ? { lte: new Date(input.to) } : {}),
            },
          }
        : {}),
    };

    const rows = await prisma.paymentEntry.findMany({
      where,
      include: entryWithRelations,
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });

    let nextCursor: string | null = null;
    if (rows.length > input.limit) {
      const next = rows.pop();
      nextCursor = next?.id ?? null;
    }
    return { entries: rows.map(serialize), nextCursor };
  });

async function assertRefsBelongToOrg(
  orgId: string,
  refs: {
    categoryId?: string | null;
    costCenterId?: string | null;
    contactId?: string | null;
    accountId?: string | null;
  },
  errors: FinanceErrors,
) {
  if (refs.categoryId) {
    const ok = await prisma.paymentCategory.findFirst({
      where: { id: refs.categoryId, organizationId: orgId },
      select: { id: true },
    });
    if (!ok) throw errors.NOT_FOUND({ message: "Categoria não encontrada" });
  }
  if (refs.costCenterId) {
    const ok = await prisma.paymentCostCenter.findFirst({
      where: { id: refs.costCenterId, organizationId: orgId },
      select: { id: true },
    });
    if (!ok)
      throw errors.NOT_FOUND({ message: "Centro de custo não encontrado" });
  }
  if (refs.contactId) {
    const ok = await prisma.paymentContact.findFirst({
      where: { id: refs.contactId, organizationId: orgId },
      select: { id: true },
    });
    if (!ok) throw errors.NOT_FOUND({ message: "Contato não encontrado" });
  }
  if (refs.accountId) {
    const ok = await prisma.paymentBankAccount.findFirst({
      where: { id: refs.accountId, organizationId: orgId },
      select: { id: true },
    });
    if (!ok) throw errors.NOT_FOUND({ message: "Conta não encontrada" });
  }
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export const createEntry = p
  .input(
    z.object({
      type: entryType,
      description: z.string().min(1, "Informe a descrição"),
      // amount = valor TOTAL em centavos (será rateado entre as parcelas).
      amount: z.number().int().positive("Informe um valor maior que zero"),
      dueDate: z.string(),
      installments: z.number().int().min(1).max(360).default(1),
      categoryId: z.string().optional(),
      costCenterId: z.string().optional(),
      contactId: z.string().optional(),
      accountId: z.string().optional(),
      competenceDate: z.string().optional(),
      documentNumber: z.string().optional(),
      notes: z.string().optional(),
      isRecurring: z.boolean().optional(),
      recurrenceType: z.string().optional(),
    }),
  )
  .output(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ input, context, errors }) => {
    await assertRefsBelongToOrg(context.org.id, input, errors);

    const n = input.installments;
    const base = Math.floor(input.amount / n);
    const remainder = input.amount - base * n;
    const groupId = n > 1 ? randomUUID() : null;
    const firstDue = new Date(input.dueDate);

    const ids = await prisma.$transaction(async (tx) => {
      const created: string[] = [];
      for (let i = 0; i < n; i++) {
        // A última parcela absorve o arredondamento para fechar o total exato.
        const amount = base + (i === n - 1 ? remainder : 0);
        const row = await tx.paymentEntry.create({
          data: {
            organizationId: context.org.id,
            type: input.type,
            status: "PENDING",
            description:
              n > 1
                ? `${input.description} (${i + 1}/${n})`
                : input.description,
            amount,
            dueDate: addMonths(firstDue, i),
            competenceDate: input.competenceDate
              ? new Date(input.competenceDate)
              : null,
            documentNumber: input.documentNumber || null,
            notes: input.notes || null,
            categoryId: input.categoryId || null,
            costCenterId: input.costCenterId || null,
            contactId: input.contactId || null,
            accountId: input.accountId || null,
            installmentTotal: n > 1 ? n : null,
            installmentCurrent: n > 1 ? i + 1 : null,
            installmentGroupId: groupId,
            isRecurring: input.isRecurring ?? false,
            recurrenceType: input.recurrenceType || null,
            createdById: context.user.id,
          },
          select: { id: true },
        });
        created.push(row.id);
      }
      return created;
    });
    return { ids };
  });

export const updateEntry = p
  .input(
    z.object({
      id: z.string(),
      description: z.string().min(1).optional(),
      amount: z.number().int().positive().optional(),
      dueDate: z.string().optional(),
      categoryId: z.string().nullable().optional(),
      costCenterId: z.string().nullable().optional(),
      contactId: z.string().nullable().optional(),
      accountId: z.string().nullable().optional(),
      competenceDate: z.string().nullable().optional(),
      documentNumber: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const entry = await prisma.paymentEntry.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, status: true, paidAmount: true },
    });
    if (!entry)
      throw errors.NOT_FOUND({ message: "Lançamento não encontrado" });
    if (entry.status === "PAID")
      throw errors.BAD_REQUEST({
        message: "Lançamento já quitado não pode ser editado",
      });
    if (input.amount !== undefined && input.amount < entry.paidAmount)
      throw errors.BAD_REQUEST({
        message: "O valor não pode ser menor que o já pago",
      });
    await assertRefsBelongToOrg(
      context.org.id,
      {
        categoryId: input.categoryId ?? undefined,
        costCenterId: input.costCenterId ?? undefined,
        contactId: input.contactId ?? undefined,
        accountId: input.accountId ?? undefined,
      },
      errors,
    );

    await prisma.paymentEntry.update({
      where: { id: input.id },
      data: {
        description: input.description,
        amount: input.amount,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        categoryId: input.categoryId,
        costCenterId: input.costCenterId,
        contactId: input.contactId,
        accountId: input.accountId,
        competenceDate:
          input.competenceDate === undefined
            ? undefined
            : input.competenceDate
              ? new Date(input.competenceDate)
              : null,
        documentNumber: input.documentNumber,
        notes: input.notes,
      },
    });
    return { ok: true };
  });

// Baixa (pagamento total ou parcial). Atualiza o saldo da conta vinculada:
// RECEIVABLE credita, PAYABLE debita.
export const payEntry = p
  .input(
    z.object({
      id: z.string(),
      amount: z.number().int().positive("Informe o valor da baixa"),
      paidAt: z.string().optional(),
      accountId: z.string().optional(),
    }),
  )
  .output(
    z.object({
      status: entryStatus,
      paidAmount: z.number().int(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const entry = await prisma.paymentEntry.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: {
        id: true,
        type: true,
        status: true,
        amount: true,
        paidAmount: true,
        accountId: true,
      },
    });
    if (!entry)
      throw errors.NOT_FOUND({ message: "Lançamento não encontrado" });
    if (entry.status === "PAID")
      throw errors.BAD_REQUEST({ message: "Lançamento já quitado" });
    if (entry.status === "CANCELLED")
      throw errors.BAD_REQUEST({ message: "Lançamento cancelado" });

    const remaining = entry.amount - entry.paidAmount;
    if (input.amount > remaining)
      throw errors.BAD_REQUEST({
        message: "Valor da baixa maior que o saldo em aberto",
      });

    const accountId = input.accountId ?? entry.accountId;
    if (input.accountId) {
      const ok = await prisma.paymentBankAccount.findFirst({
        where: { id: input.accountId, organizationId: context.org.id },
        select: { id: true },
      });
      if (!ok) throw errors.NOT_FOUND({ message: "Conta não encontrada" });
    }

    const newPaid = entry.paidAmount + input.amount;
    const fullyPaid = newPaid >= entry.amount;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.paymentEntry.update({
        where: { id: entry.id },
        data: {
          paidAmount: newPaid,
          status: fullyPaid ? "PAID" : "PARTIAL",
          paidAt: fullyPaid
            ? input.paidAt
              ? new Date(input.paidAt)
              : new Date()
            : null,
        },
        select: { status: true, paidAmount: true },
      });
      if (accountId) {
        const delta =
          entry.type === "RECEIVABLE" ? input.amount : -input.amount;
        await tx.paymentBankAccount.update({
          where: { id: accountId },
          data: { balance: { increment: delta } },
        });
      }
      return updated;
    });
    return result;
  });

export const cancelEntry = p
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const entry = await prisma.paymentEntry.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, status: true },
    });
    if (!entry)
      throw errors.NOT_FOUND({ message: "Lançamento não encontrado" });
    if (entry.status === "PAID")
      throw errors.BAD_REQUEST({
        message: "Lançamento quitado não pode ser cancelado",
      });
    await prisma.paymentEntry.update({
      where: { id: input.id },
      data: { status: "CANCELLED" },
    });
    return { ok: true };
  });

export const deleteEntry = p
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const entry = await prisma.paymentEntry.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!entry)
      throw errors.NOT_FOUND({ message: "Lançamento não encontrado" });
    await prisma.paymentEntry.delete({ where: { id: input.id } });
    return { ok: true };
  });
