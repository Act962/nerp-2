import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { isSuperUser } from "./_super-user";

// Exclui um estilo de preço. "Meus estilos" só quem é da organização; "Estilos
// do sistema" só o super usuário.
export const deletePriceStyle = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Excluir estilo de preço",
    tags: ["promotional-catalog"],
  })
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const found = await prisma.promotionalPriceStyle.findUnique({
      where: { id: input.id },
      select: { id: true, scope: true, organizationId: true },
    });
    if (!found) throw errors.NOT_FOUND({ message: "Estilo não encontrado" });

    if (found.scope === "SYSTEM") {
      if (!isSuperUser(context.user.email)) {
        throw errors.FORBIDDEN({
          message: "Apenas o super usuário pode excluir estilos do sistema",
        });
      }
    } else if (found.organizationId !== context.org.id) {
      // Não vaza entre organizações.
      throw errors.NOT_FOUND({ message: "Estilo não encontrado" });
    }

    await prisma.promotionalPriceStyle.delete({ where: { id: input.id } });
    return { ok: true };
  });
