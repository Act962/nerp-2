import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const listBrand = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ supplierId: z.string().optional() }))
  .output(
    z.object({
      brands: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          logo: z.string().nullable(),
          isActive: z.boolean(),
          // nullable: marca importada de planilha pode não ter indústria conhecida
          supplierId: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const brands = await prisma.brand.findMany({
      where: {
        organizationId: context.org.id,
        supplierId: input.supplierId,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        logo: true,
        isActive: true,
        supplierId: true,
      },
    });

    return { brands };
  });
