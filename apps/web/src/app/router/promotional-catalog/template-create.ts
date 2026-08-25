import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { isSuperUser } from "./_super-user";

// Salva o padrão (preset de estilo) com um título e a miniatura opcional. O
// `config` já vem sem os campos de produto — é só a aparência. Scope "USER" =
// padrão da organização; "SYSTEM" = padrão universal (só super usuário cria).
export const createCatalogTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Salvar padrão de catálogo",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      name: z.string().min(1, "Informe o título do padrão"),
      config: z.record(z.string(), z.unknown()),
      thumbnail: z.string().optional(),
      scope: z.enum(["USER", "SYSTEM"]).default("USER"),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (input.scope === "SYSTEM" && !isSuperUser(context.user.email)) {
      throw errors.FORBIDDEN({
        message: "Apenas o super usuário pode criar padrões do sistema",
      });
    }
    const created = await prisma.promotionalCatalogTemplate.create({
      data: {
        organizationId: input.scope === "SYSTEM" ? null : context.org.id,
        scope: input.scope,
        createdById: context.user.id,
        createdByEmail: context.user.email ?? null,
        name: input.name,
        config: input.config as object,
        thumbnail: input.thumbnail ?? null,
      },
      select: { id: true },
    });
    return { id: created.id };
  });
