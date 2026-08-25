import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { generateShareToken } from "@/lib/share-token";
import { z } from "zod";

export const createTradeCatalog = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ name: z.string().min(1, "Informe o nome do catálogo") }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const catalog = await prisma.tradeCatalog.create({
      data: {
        organizationId: context.org.id,
        name: input.name,
        createdById: context.user.id,
        shareToken: generateShareToken(),
      },
      select: { id: true },
    });

    return { id: catalog.id };
  });
