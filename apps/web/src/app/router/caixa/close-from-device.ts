import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { z } from "zod";
import { getCaixaMember, summarizeSession } from "./_access";

/**
 * Fechamento de caixa OFFLINE (replay do device). Contagem cega: o esperado é a
 * AUTORIDADE do servidor (recalculado por `summarizeSession` a partir dos
 * movimentos já sincronizados) — o cálculo local do device é só para a UX.
 *
 * Idempotente: se a sessão já está `CLOSED`, devolve o `{expected,counted,
 * difference}` gravado (replay após timeout). Resolve a sessão pela âncora
 * `clientSessionId`. O drain estrito garante que TODAS as vendas/movimentos da
 * sessão já drenaram antes deste fechamento — o esperado sai completo.
 */
export const closeCaixaFromDevice = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      operationId: z.string().min(1),
      clientSessionId: z.string().min(1),
      countedBalance: z.number().min(0),
      closedAt: z.string().optional(),
      closingNotes: z.string().optional(),
    }),
  )
  .output(
    z.object({
      expectedBalance: z.number(),
      countedBalance: z.number(),
      difference: z.number(),
      duplicate: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const orgId = context.org.id;

    const session = await prisma.cashSession.findUnique({
      where: { clientSessionId: input.clientSessionId },
      select: {
        id: true,
        organizationId: true,
        status: true,
        openingBalance: true,
        expectedBalance: true,
        countedBalance: true,
        difference: true,
        movements: {
          select: { type: true, amount: true, paymentMethod: true },
        },
      },
    });
    if (!session || session.organizationId !== orgId)
      throw errors.NOT_FOUND({ message: "Sessão de caixa não encontrada" });

    // Idempotência: já fechado → devolve o resultado gravado.
    if (session.status === "CLOSED") {
      return {
        expectedBalance: Number(session.expectedBalance ?? 0),
        countedBalance: Number(session.countedBalance ?? 0),
        difference: Number(session.difference ?? 0),
        duplicate: true,
      };
    }

    const member = await getCaixaMember(orgId, context.user.id);
    if (!member)
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    if (!memberCan(member, "caixa-fechar"))
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para fechar o caixa",
      });

    const { expectedCash } = summarizeSession(
      Number(session.openingBalance),
      session.movements.map((m) => ({
        type: m.type,
        amount: Number(m.amount),
        paymentMethod: m.paymentMethod,
      })),
    );
    const difference = input.countedBalance - expectedCash;
    const closedAt = input.closedAt ? new Date(input.closedAt) : new Date();

    await prisma.$transaction([
      prisma.cashSession.update({
        where: { id: session.id },
        data: {
          status: "CLOSED",
          closedAt,
          closedById: context.user.id,
          expectedBalance: expectedCash,
          countedBalance: input.countedBalance,
          difference,
          closingNotes: input.closingNotes ?? null,
        },
      }),
      prisma.cashMovement.create({
        data: {
          organizationId: orgId,
          sessionId: session.id,
          clientOperationId: input.operationId,
          type: "FECHAMENTO",
          amount: input.countedBalance,
          description: "Fechamento de caixa",
          createdById: context.user.id,
        },
      }),
    ]);

    return {
      expectedBalance: expectedCash,
      countedBalance: input.countedBalance,
      difference,
      duplicate: false,
    };
  });
