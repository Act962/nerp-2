import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { isSuperUser } from "./_super-user";

// Salva um estilo de preço (preset do "Padrão de estilos de preços"). Scope
// "USER" = "Meus estilos" da organização; "SYSTEM" = "Estilos do sistema"
// (global), que só o super usuário pode criar.
export const createPriceStyle = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Salvar estilo de preço",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      name: z.string().min(1, "Informe o nome do estilo"),
      style: z.record(z.string(), z.unknown()),
      scope: z.enum(["USER", "SYSTEM"]).default("USER"),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (input.scope === "SYSTEM" && !isSuperUser(context.user.email)) {
      throw errors.FORBIDDEN({
        message: "Apenas o super usuário pode criar estilos do sistema",
      });
    }
    const created = await prisma.promotionalPriceStyle.create({
      data: {
        organizationId: input.scope === "SYSTEM" ? null : context.org.id,
        scope: input.scope,
        name: input.name,
        style: input.style as object,
        createdById: context.user.id,
        createdByEmail: context.user.email ?? null,
      },
      select: { id: true },
    });
    return { id: created.id };
  });
