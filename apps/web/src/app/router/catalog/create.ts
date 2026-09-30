import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

export const createSettingsCatalog = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Criar configurações de catálogo",
    tags: ["settings-catalog"],
  })
  .input(
    z.object({
      name: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    // Upsert e não create: `organizationId` é único, e um segundo clique (ou
    // o `list`, que também cria) faria o create estourar a constraint.
    const catalogSettings = await prisma.catalogSettings.upsert({
      where: { organizationId: context.org.id },
      create: {
        organizationId: context.org.id,
        metaTitle: input.name,
      },
      update: {},
      select: { id: true },
    });
    return { id: catalogSettings.id };
  });
