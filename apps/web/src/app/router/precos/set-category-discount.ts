import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Upsert do desconto de uma categoria numa tabela de preços. Uma regra por
// (tabela, categoria): mudar o percentual é update, não uma segunda linha
// competindo com a primeira.
export const setCategoryDiscount = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z
      .object({
        priceListId: z.string(),
        categoryId: z.string(),
        percentDiscount: z.number().gt(0).lte(100),
        /** ISO. Vazio = vale desde já. */
        startsAt: z.string().nullable().optional(),
        /** ISO. Obrigatório — promoção sem fim vira preço permanente. */
        endsAt: z.string(),
      })
      .refine(
        (data) =>
          !data.startsAt || new Date(data.startsAt) <= new Date(data.endsAt),
        { message: "O início não pode ser depois do fim", path: ["endsAt"] },
      ),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    // Tabela e categoria revalidadas contra a org — id vindo da entrada nunca
    // é confiável por si só.
    const [priceList, category] = await Promise.all([
      prisma.priceList.findFirst({
        where: { id: input.priceListId, organizationId: context.org.id },
        select: { id: true },
      }),
      prisma.category.findFirst({
        where: { id: input.categoryId, organizationId: context.org.id },
        select: { id: true },
      }),
    ]);
    if (!priceList) {
      throw errors.NOT_FOUND({ message: "Tabela de preço não encontrada" });
    }
    if (!category) {
      throw errors.NOT_FOUND({ message: "Categoria não encontrada" });
    }

    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(endsAt.getTime())) {
      throw errors.BAD_REQUEST({ message: "Data de fim inválida" });
    }
    const startsAt = input.startsAt ? new Date(input.startsAt) : null;
    if (startsAt && Number.isNaN(startsAt.getTime())) {
      throw errors.BAD_REQUEST({ message: "Data de início inválida" });
    }

    const row = await prisma.priceListCategoryDiscount.upsert({
      where: {
        priceListId_categoryId: {
          priceListId: input.priceListId,
          categoryId: input.categoryId,
        },
      },
      create: {
        organizationId: context.org.id,
        priceListId: input.priceListId,
        categoryId: input.categoryId,
        percentDiscount: input.percentDiscount,
        startsAt,
        endsAt,
      },
      update: {
        percentDiscount: input.percentDiscount,
        startsAt,
        endsAt,
      },
      select: { id: true },
    });

    return { id: row.id };
  });
