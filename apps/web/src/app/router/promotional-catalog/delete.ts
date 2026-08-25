import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

export const deleteCatalog = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "DELETE",
    summary: "Deletar catálogo promocional",
    tags: ["promotional-catalog"],
  })
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.promotionalCatalog.findUnique({
      where: { id: input.id },
    });

    if (!existing || existing.organizationId !== context.org.id) {
      throw errors.NOT_FOUND();
    }

    await prisma.promotionalCatalog.delete({ where: { id: input.id } });

    return { success: true as const };
  });
