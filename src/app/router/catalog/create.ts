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
      name: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    await prisma.catalogSettings.create({
      data: {
        organizationId: context.org.id,
        metaTitle: input.name,
      },
    });
  });
