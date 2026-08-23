import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { isSuperUser } from "./_super-user";

// Atualiza um estilo de preço salvo (nome e/ou desenho). "Meus estilos" só quem
// é da organização; "Estilos do sistema" só o super usuário.
export const updatePriceStyle = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Atualizar estilo de preço",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      style: z.record(z.string(), z.unknown()).optional(),
    }),
  )
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
          message: "Apenas o super usuário pode editar estilos do sistema",
        });
      }
    } else if (found.organizationId !== context.org.id) {
      throw errors.NOT_FOUND({ message: "Estilo não encontrado" });
    }

    await prisma.promotionalPriceStyle.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.style !== undefined ? { style: input.style as object } : {}),
      },
    });
    return { ok: true };
  });
