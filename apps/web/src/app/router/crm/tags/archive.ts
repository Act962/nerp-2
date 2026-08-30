import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

/**
 * Arquiva a etiqueta em vez de apagar.
 *
 * Apagar levaria junto a marcação de todo lead que já a teve — e o histórico
 * de "por que este contato foi marcado assim" é justamente o que se consulta
 * depois. Arquivada, ela some do seletor e continua resolvível.
 */
export const archiveTag = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Arquiva etiqueta", tags: ["CRM"] })
  .input(z.object({ tagId: z.string().min(1) }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const { count } = await prisma.crmTag.updateMany({
      where: {
        id: input.tagId,
        organizationId: context.org.id,
        archivedAt: null,
      },
      data: { archivedAt: new Date(), archivedById: context.user.id },
    });

    if (count === 0) {
      throw errors.NOT_FOUND({ message: "Etiqueta não encontrada" });
    }
    return { ok: true };
  });
