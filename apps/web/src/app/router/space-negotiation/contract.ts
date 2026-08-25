import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { ContractStatus } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

// Contratos de espaço: promove uma negociação a contrato de 1a classe (ciclo de
// vida próprio) e gera os recebíveis no Financeiro. Reusa SpaceNegotiation.
const p = base.use(requireAuthMiddleware).use(requireOrgMiddleware);

const MAX_INSTALLMENTS = 120; // teto de segurança (10 anos mensais)

/** Primeiros dias de cada mês entre start e end (competências mensais, UTC). */
function monthlyCompetences(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cur = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
  );
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cur <= last && dates.length < MAX_INSTALLMENTS) {
    dates.push(new Date(cur));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return dates;
}

const contractOutput = z.object({
  id: z.string(),
  mapObjectId: z.string(),
  spaceCode: z.string().nullable(),
  spaceName: z.string().nullable(),
  supplierName: z.string().nullable(),
  amount: z.number().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  contractStatus: z.enum(ContractStatus).nullable(),
  billing: z.enum(["MENSAL", "UNICO"]).nullable(),
  activatedAt: z.string().nullable(),
  entriesCount: z.number().int(),
});

// Ativa o contrato: valida vigência exclusiva por espaço e gera os recebíveis.
export const activateContract = p
  .input(
    z.object({
      negotiationId: z.string(),
      billing: z.enum(["MENSAL", "UNICO"]),
      categoryId: z.string().nullable().optional(),
      accountId: z.string().nullable().optional(),
      contactId: z.string().nullable().optional(),
    }),
  )
  .output(z.object({ id: z.string(), entriesCreated: z.number().int() }))
  .handler(async ({ input, context, errors }) => {
    const negotiation = await prisma.spaceNegotiation.findFirst({
      where: { id: input.negotiationId, organizationId: context.org.id },
      select: {
        id: true,
        mapObjectId: true,
        supplierId: true,
        startDate: true,
        endDate: true,
        amount: true,
        contractStatus: true,
        mapObject: { select: { spaceCode: true, name: true } },
        supplier: { select: { name: true } },
      },
    });
    if (!negotiation) {
      throw errors.NOT_FOUND({ message: "Negociação não encontrada" });
    }
    if (negotiation.contractStatus === "ATIVO") {
      throw errors.BAD_REQUEST({ message: "Contrato já está ativo" });
    }
    const { startDate, endDate } = negotiation;
    if (!startDate || !endDate) {
      throw errors.BAD_REQUEST({
        message: "Defina início e fim antes de ativar o contrato",
      });
    }
    if (endDate < startDate) {
      throw errors.BAD_REQUEST({ message: "Fim antes do início" });
    }
    const amountReais = negotiation.amount ? Number(negotiation.amount) : 0;
    if (amountReais <= 0) {
      throw errors.BAD_REQUEST({ message: "Informe o valor do contrato" });
    }

    // Vigência exclusiva: nenhum outro contrato ATIVO sobreposto no mesmo espaço.
    const conflict = await prisma.spaceNegotiation.findFirst({
      where: {
        organizationId: context.org.id,
        mapObjectId: negotiation.mapObjectId,
        contractStatus: "ATIVO",
        id: { not: negotiation.id },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    });
    if (conflict) {
      throw errors.BAD_REQUEST({
        message: "Já existe um contrato vigente neste espaço no período",
      });
    }

    const amountCents = Math.round(amountReais * 100);
    const competences =
      input.billing === "MENSAL"
        ? monthlyCompetences(startDate, endDate)
        : [startDate];

    const label = `Contrato ${negotiation.mapObject?.spaceCode ?? negotiation.mapObject?.name ?? "espaço"}${
      negotiation.supplier?.name ? ` — ${negotiation.supplier.name}` : ""
    }`;

    await prisma.$transaction([
      prisma.paymentEntry.createMany({
        data: competences.map((date) => ({
          organizationId: context.org.id,
          type: "RECEIVABLE" as const,
          status: "PENDING" as const,
          description: label,
          amount: amountCents,
          dueDate: date,
          competenceDate: date,
          categoryId: input.categoryId ?? null,
          accountId: input.accountId ?? null,
          contactId: input.contactId ?? null,
          spaceNegotiationId: negotiation.id,
          createdById: context.user.id,
        })),
      }),
      prisma.spaceNegotiation.update({
        where: { id: negotiation.id },
        data: {
          status: "FECHADA",
          contractStatus: "ATIVO",
          contractBilling: input.billing,
          contractActivatedAt: new Date(),
        },
      }),
      prisma.mapObject.update({
        where: { id: negotiation.mapObjectId },
        data: { spaceState: "EXECUTADO" },
      }),
    ]);

    return { id: negotiation.id, entriesCreated: competences.length };
  });

// Cancela/rescinde o contrato: cancela os recebíveis pendentes e libera o espaço.
export const cancelContract = p
  .input(z.object({ negotiationId: z.string() }))
  .output(z.object({ ok: z.boolean(), entriesCancelled: z.number().int() }))
  .handler(async ({ input, context, errors }) => {
    const negotiation = await prisma.spaceNegotiation.findFirst({
      where: { id: input.negotiationId, organizationId: context.org.id },
      select: { id: true, mapObjectId: true, contractStatus: true },
    });
    if (!negotiation || !negotiation.contractStatus) {
      throw errors.NOT_FOUND({ message: "Contrato não encontrado" });
    }

    const cancelled = await prisma.paymentEntry.updateMany({
      where: {
        organizationId: context.org.id,
        spaceNegotiationId: negotiation.id,
        status: { in: ["PENDING", "PARTIAL"] },
      },
      data: { status: "CANCELLED" },
    });

    await prisma.spaceNegotiation.update({
      where: { id: negotiation.id },
      data: { contractStatus: "CANCELADO" },
    });

    // Libera o espaço se não sobrou outro contrato ativo nele.
    const stillActive = await prisma.spaceNegotiation.findFirst({
      where: {
        organizationId: context.org.id,
        mapObjectId: negotiation.mapObjectId,
        contractStatus: "ATIVO",
      },
      select: { id: true },
    });
    if (!stillActive) {
      await prisma.mapObject.update({
        where: { id: negotiation.mapObjectId },
        data: { spaceState: "LIVRE" },
      });
    }

    return { ok: true, entriesCancelled: cancelled.count };
  });

// Lista os contratos (negociações com contractStatus setado) da organização.
export const listContracts = p
  .input(
    z
      .object({
        status: z.enum(ContractStatus).optional(),
        mapObjectId: z.string().optional(),
      })
      .optional(),
  )
  .output(z.object({ contracts: z.array(contractOutput) }))
  .handler(async ({ input, context }) => {
    const rows = await prisma.spaceNegotiation.findMany({
      where: {
        organizationId: context.org.id,
        contractStatus: input?.status ?? { not: null },
        ...(input?.mapObjectId ? { mapObjectId: input.mapObjectId } : {}),
      },
      select: {
        id: true,
        mapObjectId: true,
        amount: true,
        startDate: true,
        endDate: true,
        contractStatus: true,
        contractBilling: true,
        contractActivatedAt: true,
        mapObject: { select: { spaceCode: true, name: true } },
        supplier: { select: { name: true } },
        _count: { select: { financeiroEntries: true } },
      },
      orderBy: [{ contractActivatedAt: "desc" }, { createdAt: "desc" }],
    });

    return {
      contracts: rows.map((r) => ({
        id: r.id,
        mapObjectId: r.mapObjectId,
        spaceCode: r.mapObject?.spaceCode ?? null,
        spaceName: r.mapObject?.name ?? null,
        supplierName: r.supplier?.name ?? null,
        amount: r.amount ? Number(r.amount) : null,
        startDate: r.startDate?.toISOString() ?? null,
        endDate: r.endDate?.toISOString() ?? null,
        contractStatus: r.contractStatus,
        billing: r.contractBilling,
        activatedAt: r.contractActivatedAt?.toISOString() ?? null,
        entriesCount: r._count.financeiroEntries,
      })),
    };
  });

// Marca como EXPIRADO os contratos ativos cuja vigência já terminou.
export const expireContracts = p
  .input(z.void())
  .output(z.object({ expired: z.number().int() }))
  .handler(async ({ context }) => {
    const now = new Date();
    const result = await prisma.spaceNegotiation.updateMany({
      where: {
        organizationId: context.org.id,
        contractStatus: "ATIVO",
        endDate: { lt: now },
      },
      data: { contractStatus: "EXPIRADO" },
    });
    return { expired: result.count };
  });
