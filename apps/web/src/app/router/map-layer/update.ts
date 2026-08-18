import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const updateMapLayer = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      visible: z.boolean().optional(),
      locked: z.boolean().optional(),
      color: z.string().nullable().optional(),
      order: z.number().int().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id, ...data } = input;

    const layer = await prisma.mapLayer.findFirst({
      where: { id, organizationId: context.org.id },
      select: { id: true },
    });

    if (!layer) {
      throw errors.NOT_FOUND({ message: "Camada não encontrada" });
    }

    return prisma.mapLayer.update({
      where: { id },
      data,
      select: { id: true },
    });
  });
