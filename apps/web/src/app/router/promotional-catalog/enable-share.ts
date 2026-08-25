import { randomUUID } from "node:crypto";
import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Gera (ou retorna) o token de link público do catálogo. O token vive dentro do
// `config` (JSON) — sem migration. O update do catálogo faz merge, então o
// autosave da config NÃO apaga o token.
export const enableCatalogShare = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Ativar link público do catálogo",
    tags: ["promotional-catalog"],
  })
  .input(z.object({ id: z.string() }))
  .output(z.object({ shareToken: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.promotionalCatalog.findUnique({
      where: { id: input.id },
    });
    if (!existing || existing.organizationId !== context.org.id) {
      throw errors.NOT_FOUND();
    }

    const config = (existing.config as Record<string, unknown>) ?? {};
    let shareToken = config.shareToken as string | undefined;
    if (!shareToken) {
      shareToken = randomUUID().replace(/-/g, "");
      await prisma.promotionalCatalog.update({
        where: { id: input.id },
        data: { config: { ...config, shareToken } as object },
      });
    }
    return { shareToken };
  });
