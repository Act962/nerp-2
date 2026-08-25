import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Registra uma etiqueta na biblioteca. O PNG já foi enviado ao R2 pelo cliente
// (uploadToR2) — aqui só guardamos a chave + nome.
export const createCatalogAsset = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Adicionar etiqueta ao catálogo",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      name: z.string().min(1),
      key: z.string().min(1),
    }),
  )
  .output(z.object({ id: z.string(), key: z.string() }))
  .handler(async ({ input, context }) => {
    const created = await prisma.catalogAsset.create({
      data: {
        organizationId: context.org.id,
        createdById: context.user.id,
        name: input.name,
        key: input.key,
      },
      select: { id: true, key: true },
    });
    return created;
  });
