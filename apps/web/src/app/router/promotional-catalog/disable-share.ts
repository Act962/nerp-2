import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Desativa o link público: remove o `shareToken` do config (o link vira 404).
export const disableCatalogShare = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Desativar link público do catálogo",
    tags: ["promotional-catalog"],
  })
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.promotionalCatalog.findUnique({
      where: { id: input.id },
    });
    if (!existing || existing.organizationId !== context.org.id) {
      throw errors.NOT_FOUND();
    }
    const config = { ...((existing.config as Record<string, unknown>) ?? {}) };
    delete config.shareToken;
    await prisma.promotionalCatalog.update({
      where: { id: input.id },
      data: { config: config as object },
    });
    return { ok: true };
  });
