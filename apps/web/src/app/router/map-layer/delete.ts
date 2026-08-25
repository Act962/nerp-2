import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const deleteMapLayer = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const layer = await prisma.mapLayer.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });

    if (!layer) {
      throw errors.NOT_FOUND({ message: "Camada não encontrada" });
    }

    return prisma.mapLayer.delete({ where: { id: input.id } });
  });
