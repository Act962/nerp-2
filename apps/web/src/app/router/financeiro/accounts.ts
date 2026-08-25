import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Contas financeiras (banco/caixa/carteira). Saldos em CENTAVOS (Int).
const p = base.use(requireAuthMiddleware).use(requireOrgMiddleware);

const accountType = z.enum(["CHECKING", "SAVINGS", "CASH", "DIGITAL"]);

const accountOutput = z.object({
  id: z.string(),
  name: z.string(),
  bankName: z.string().nullable(),
  bankCode: z.string().nullable(),
  agency: z.string().nullable(),
  account: z.string().nullable(),
  type: accountType,
  balance: z.number().int(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  color: z.string().nullable(),
});

export const listAccounts = p
  .input(z.object({ includeInactive: z.boolean().optional() }).optional())
  .output(z.object({ accounts: z.array(accountOutput) }))
  .handler(async ({ input, context }) => {
    const accounts = await prisma.paymentBankAccount.findMany({
      where: {
        organizationId: context.org.id,
        ...(input?.includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    return { accounts };
  });

export const createAccount = p
  .input(
    z.object({
      name: z.string().min(1, "Informe o nome da conta"),
      bankName: z.string().optional(),
      bankCode: z.string().optional(),
      agency: z.string().optional(),
      account: z.string().optional(),
      type: accountType.default("CHECKING"),
      balance: z.number().int().default(0),
      color: z.string().optional(),
      isDefault: z.boolean().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const created = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.paymentBankAccount.updateMany({
          where: { organizationId: context.org.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.paymentBankAccount.create({
        data: {
          organizationId: context.org.id,
          name: input.name,
          bankName: input.bankName || null,
          bankCode: input.bankCode || null,
          agency: input.agency || null,
          account: input.account || null,
          type: input.type,
          balance: input.balance,
          color: input.color || null,
          isDefault: input.isDefault ?? false,
        },
        select: { id: true },
      });
    });
    return created;
  });

export const updateAccount = p
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      bankName: z.string().nullable().optional(),
      bankCode: z.string().nullable().optional(),
      agency: z.string().nullable().optional(),
      account: z.string().nullable().optional(),
      type: accountType.optional(),
      color: z.string().nullable().optional(),
      isActive: z.boolean().optional(),
      isDefault: z.boolean().optional(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const account = await prisma.paymentBankAccount.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!account) throw errors.NOT_FOUND({ message: "Conta não encontrada" });

    await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.paymentBankAccount.updateMany({
          where: { organizationId: context.org.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      await tx.paymentBankAccount.update({
        where: { id: input.id },
        data: {
          name: input.name,
          bankName: input.bankName,
          bankCode: input.bankCode,
          agency: input.agency,
          account: input.account,
          type: input.type,
          color: input.color,
          isActive: input.isActive,
          isDefault: input.isDefault,
        },
      });
    });
    return { ok: true };
  });

export const deleteAccount = p
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean(), deactivated: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const account = await prisma.paymentBankAccount.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, _count: { select: { entries: true } } },
    });
    if (!account) throw errors.NOT_FOUND({ message: "Conta não encontrada" });

    // Com lançamentos vinculados, desativa (preserva histórico); senão remove.
    if (account._count.entries > 0) {
      await prisma.paymentBankAccount.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      return { ok: true, deactivated: true };
    }
    await prisma.paymentBankAccount.delete({ where: { id: input.id } });
    return { ok: true, deactivated: false };
  });
