import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { getCaixaMember, summarizeSession } from "./_access";

// Sessão de caixa ABERTA do operador atual (ou null). Sem action key: qualquer
// membro consulta o próprio caixa — é o que o PDV usa para liberar a venda.
export const getCurrentCaixa = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .output(
    z.object({
      session: z
        .object({
          id: z.string(),
          openedAt: z.string(),
          openingBalance: z.number(),
          salesTotal: z.number(),
          salesCash: z.number(),
          suprimentos: z.number(),
          sangrias: z.number(),
          expectedCash: z.number(),
          movementCount: z.number(),
        })
        .nullable(),
    }),
  )
  .handler(async ({ context }) => {
    const member = await getCaixaMember(context.org.id, context.user.id);
    if (!member) return { session: null };

    const session = await prisma.cashSession.findFirst({
      where: {
        organizationId: context.org.id,
        memberId: member.id,
        status: "OPEN",
      },
      select: {
        id: true,
        openedAt: true,
        openingBalance: true,
        movements: {
          select: { type: true, amount: true, paymentMethod: true },
        },
      },
    });
    if (!session) return { session: null };

    const summary = summarizeSession(
      Number(session.openingBalance),
      session.movements.map((movement) => ({
        type: movement.type,
        amount: Number(movement.amount),
        paymentMethod: movement.paymentMethod,
      })),
    );

    return {
      session: {
        id: session.id,
        openedAt: session.openedAt.toISOString(),
        openingBalance: Number(session.openingBalance),
        salesTotal: summary.salesTotal,
        salesCash: summary.salesCash,
        suprimentos: summary.suprimentos,
        sangrias: summary.sangrias,
        expectedCash: summary.expectedCash,
        movementCount: session.movements.length,
      },
    };
  });
