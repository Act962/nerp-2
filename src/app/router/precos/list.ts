import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Lista todas as tabelas de preço da org (ativas + inativas). O front usa esse
// dado no painel /precos, nos Selects de Cliente/Produto e no PDV.
export const listPriceLists = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .output(
    z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        description: z.string().nullable(),
        isDefault: z.boolean(),
        isActive: z.boolean(),
        productPriceCount: z.number(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const rows = await prisma.priceList.findMany({
      where: { organizationId: context.org.id },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: { _count: { select: { productPrices: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      isDefault: r.isDefault,
      isActive: r.isActive,
      productPriceCount: r._count.productPrices,
    }));
  });
