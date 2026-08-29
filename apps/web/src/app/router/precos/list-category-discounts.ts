import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Descontos de categoria de uma tabela, VIGENTES E EXPIRADOS. A tela precisa
// mostrar os vencidos para o usuário reaproveitar ou apagar — a resolução de
// preço é que ignora quem está fora da janela.
export const listCategoryDiscounts = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ priceListId: z.string() }))
  .output(
    z.object({
      discounts: z.array(
        z.object({
          id: z.string(),
          categoryId: z.string(),
          categoryName: z.string(),
          percentDiscount: z.number(),
          startsAt: z.string().nullable(),
          endsAt: z.string(),
          isActive: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const priceList = await prisma.priceList.findFirst({
      where: { id: input.priceListId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!priceList) {
      throw errors.NOT_FOUND({ message: "Tabela de preço não encontrada" });
    }

    const rows = await prisma.priceListCategoryDiscount.findMany({
      where: {
        priceListId: input.priceListId,
        organizationId: context.org.id,
      },
      select: {
        id: true,
        categoryId: true,
        percentDiscount: true,
        startsAt: true,
        endsAt: true,
        category: { select: { name: true } },
      },
      orderBy: { endsAt: "desc" },
    });

    const now = new Date();
    return {
      discounts: rows.map((row) => ({
        id: row.id,
        categoryId: row.categoryId,
        categoryName: row.category.name,
        percentDiscount: Number(row.percentDiscount),
        startsAt: row.startsAt?.toISOString() ?? null,
        endsAt: row.endsAt.toISOString(),
        isActive: row.endsAt >= now && (!row.startsAt || row.startsAt <= now),
      })),
    };
  });
