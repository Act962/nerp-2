import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const upsertMediaTypePrice = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      storeId: z.string(),
      mediaTypeId: z.string(),
      price: z.number().nonnegative(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const store = await prisma.store.findFirst({
      where: { id: input.storeId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!store) throw errors.NOT_FOUND({ message: "Loja não encontrada" });

    const mediaType = await prisma.mediaType.findFirst({
      where: { id: input.mediaTypeId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!mediaType) {
      throw errors.BAD_REQUEST({ message: "Tipo de mídia inválido" });
    }

    const price = await prisma.mediaTypePrice.upsert({
      where: {
        storeId_mediaTypeId: {
          storeId: input.storeId,
          mediaTypeId: input.mediaTypeId,
        },
      },
      create: {
        organizationId: context.org.id,
        storeId: input.storeId,
        mediaTypeId: input.mediaTypeId,
        price: input.price,
        isManual: true,
      },
      update: { price: input.price, isManual: true },
      select: { id: true },
    });

    return { id: price.id };
  });
