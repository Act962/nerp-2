import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const listSupplierBrands = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ supplierId: z.string() }))
  .handler(async ({ input, context }) => {
    const brands = await prisma.brand.findMany({
      where: {
        supplierId: input.supplierId,
        organizationId: context.org.id,
        isActive: true,
        logo: { not: null },
      },
      select: { id: true, name: true, logo: true },
      orderBy: { name: "asc" },
    });
    return { brands };
  });
