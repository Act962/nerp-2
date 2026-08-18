import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const listMediaTypePrice = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ storeId: z.string() }))
  .handler(async ({ input, context }) => {
    const items = await prisma.mediaTypePrice.findMany({
      where: { storeId: input.storeId, organizationId: context.org.id },
      select: { id: true, mediaTypeId: true, price: true, isManual: true },
    });

    return {
      items: items.map((item) => ({
        ...item,
        price: Number(item.price),
      })),
    };
  });
