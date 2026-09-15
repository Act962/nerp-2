import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

/**
 * Marca em que passo a pessoa está.
 *
 * É o que permite fechar o navegador no meio e voltar depois de onde parou —
 * o `sessionStorage` morre com a aba, este número não.
 *
 * Monotônico de propósito (`passoAtual: { lt: passo }`): duas abas abertas na
 * mesma jornada não fazem o progresso andar para trás.
 */
export const avancar = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Marcar passo", tags: ["Jornadas"] })
  .input(
    z.object({
      jornadaId: z.string().min(1),
      passo: z.number().int().min(0),
      apressos: z.number().int().min(0),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    await prisma.jornadaProgresso.updateMany({
      where: {
        organizationId: context.org.id,
        userId: context.user.id,
        jornadaId: input.jornadaId,
        concluidaEm: null,
        passoAtual: { lt: input.passo },
      },
      data: { passoAtual: input.passo, apressos: input.apressos },
    });
    return { ok: true as const };
  });
