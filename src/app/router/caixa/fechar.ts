import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { z } from "zod";
import { getCaixaMember, summarizeSession } from "./_access";

export const fecharCaixa = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Fechar o caixa (contagem cega)",
    tags: ["caixa"],
  })
  .input(
    z.object({
      countedBalance: z.number().min(0),
      closingNotes: z.string().optional(),
    }),
  )
  .output(
    z.object({
      expectedBalance: z.number(),
      countedBalance: z.number(),
      difference: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const member = await getCaixaMember(context.org.id, context.user.id);
    if (!member)
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    if (!memberCan(member, "caixa-fechar"))
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para fechar o caixa",
      });

    const session = await prisma.cashSession.findFirst({
      where: {
        organizationId: context.org.id,
        memberId: member.id,
        status: "OPEN",
      },
      select: {
        id: true,
        openingBalance: true,
        movements: {
          select: { type: true, amount: true, paymentMethod: true },
        },
      },
    });
    if (!session)
      throw errors.BAD_REQUEST({ message: "Você não tem um caixa aberto" });

    const { expectedCash } = summarizeSession(
      Number(session.openingBalance),
      session.movements.map((movement) => ({
        type: movement.type,
        amount: Number(movement.amount),
        paymentMethod: movement.paymentMethod,
      })),
    );
    const difference = input.countedBalance - expectedCash;

    await prisma.$transaction([
      prisma.cashSession.update({
        where: { id: session.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedById: context.user.id,
          expectedBalance: expectedCash,
          countedBalance: input.countedBalance,
          difference,
          closingNotes: input.closingNotes ?? null,
        },
      }),
      prisma.cashMovement.create({
        data: {
          organizationId: context.org.id,
          sessionId: session.id,
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
    };
  });
