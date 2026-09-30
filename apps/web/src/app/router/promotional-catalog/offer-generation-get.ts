import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { emEstrelas } from "@/features/stars/lib/decimal";
import type { ResultadoDaGeracao } from "@/features/promotional-catalog/server/gerar-oferta";

// O cliente faz polling aqui enquanto a função do Inngest trabalha.
export const offerGenerationGet = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Status de uma geração de oferta com IA",
    tags: ["promotional-catalog"],
  })
  .input(z.object({ id: z.string() }))
  .output(
    z.object({
      status: z.enum(["PENDING", "GENERATING", "DONE", "FAILED"]),
      erro: z.string().nullable(),
      starsCobradas: z.number(),
      // Parâmetros finais do compositor e o catálogo criado (quando novo).
      resultado: z.custom<ResultadoDaGeracao>().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const g = await prisma.promotionalOfferGeneration.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: {
        status: true,
        erro: true,
        starsCobradas: true,
        resultado: true,
      },
    });
    if (!g) throw errors.NOT_FOUND();
    return {
      status: g.status,
      erro: g.erro,
      starsCobradas: emEstrelas(g.starsCobradas),
      resultado: (g.resultado ?? null) as ResultadoDaGeracao | null,
    };
  });
