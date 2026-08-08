import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { getCaixaMember } from "./_access";

// Livro de movimentos de uma sessão (validada contra a org).
export const listCaixaMovements = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ sessionId: z.string() }))
  .output(
    z.object({
      movements: z.array(
        z.object({
          id: z.string(),
          type: z.enum([
            "ABERTURA",
            "SUPRIMENTO",
            "SANGRIA",
            "VENDA",
            "FECHAMENTO",
          ]),
          amount: z.number(),
          paymentMethod: z.string().nullable(),
          description: z.string().nullable(),
          saleId: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const member = await getCaixaMember(context.org.id, context.user.id);
    if (!member)
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });

    const session = await prisma.cashSession.findFirst({
      where: { id: input.sessionId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!session)
      throw errors.NOT_FOUND({ message: "Sessão de caixa não encontrada" });

    const movements = await prisma.cashMovement.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        amount: true,
        paymentMethod: true,
        description: true,
        saleId: true,
        createdAt: true,
      },
    });

    return {
      movements: movements.map((movement) => ({
        id: movement.id,
        type: movement.type,
        amount: Number(movement.amount),
        paymentMethod: movement.paymentMethod,
        description: movement.description,
        saleId: movement.saleId,
        createdAt: movement.createdAt.toISOString(),
      })),
    };
  });
