import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

/**
 * Extrato.
 *
 * Cada linha guarda o saldo resultante no momento em que aconteceu — é o que
 * permite auditar sem reprocessar a soma inteira, e o que deixa uma
 * divergência aparecer em vez de se dissolver no total.
 */
export const listTransactions = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Extrato de ★", tags: ["Stars"] })
  .input(
    z.object({
      cursor: z.string().optional(),
      limite: z.number().int().min(1).max(100).default(30),
    }),
  )
  .output(
    z.object({
      lancamentos: z.array(
        z.object({
          id: z.string(),
          tipo: z.string(),
          valor: z.number(),
          saldoDepois: z.number(),
          descricao: z.string(),
          quando: z.string(),
        }),
      ),
      proximoCursor: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const lancamentos = await prisma.starTransaction.findMany({
      where: {
        organizationId: context.org.id,
        ...(input.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: input.limite,
      select: {
        id: true,
        type: true,
        amount: true,
        balanceAfter: true,
        description: true,
        createdAt: true,
      },
    });

    const ultimo = lancamentos.at(-1);

    return {
      lancamentos: lancamentos.map((linha) => ({
        id: linha.id,
        tipo: linha.type,
        valor: linha.amount,
        saldoDepois: linha.balanceAfter,
        descricao: linha.description,
        quando: linha.createdAt.toISOString(),
      })),
      proximoCursor:
        lancamentos.length === input.limite && ultimo
          ? ultimo.createdAt.toISOString()
          : null,
    };
  });
