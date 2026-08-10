import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { z } from "zod";
import { getCaixaMember } from "./_access";

// Suprimento: entrada de dinheiro na gaveta (aumenta o esperado em dinheiro).
export const suprimentoCaixa = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Suprimento no caixa", tags: ["caixa"] })
  .input(
    z.object({
      amount: z.number().positive(),
      description: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const member = await getCaixaMember(context.org.id, context.user.id);
    if (!member)
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    if (!memberCan(member, "caixa-suprimento"))
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para fazer suprimento",
      });

    const session = await prisma.cashSession.findFirst({
      where: {
        organizationId: context.org.id,
        memberId: member.id,
        status: "OPEN",
      },
      select: { id: true },
    });
    if (!session)
      throw errors.BAD_REQUEST({ message: "Você não tem um caixa aberto" });

    const movement = await prisma.cashMovement.create({
      data: {
        organizationId: context.org.id,
        sessionId: session.id,
        type: "SUPRIMENTO",
        amount: input.amount,
        description: input.description ?? null,
        createdById: context.user.id,
      },
      select: { id: true },
    });
    return { id: movement.id };
  });
