import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import z from "zod";
import { requireMemberOfOrgSlug } from "./_require-member-of-org-slug";

// Produtos para o balcão montar o pedido: foto, preço e tempo de preparo. Era
// pública e entregava o catálogo ativo inteiro a quem soubesse o slug; agora
// exige sessão + vínculo, que a página do garçom já tinha.
export const waiterProducts = base
  .use(requireAuthMiddleware)
  .route({
    method: "GET",
    summary: "Produtos ativos da org (kiosk do garçom)",
    tags: ["kitchen"],
  })
  .input(z.object({ orgSlug: z.string().min(1) }))
  .output(
    z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        prepTimeMinutes: z.number().nullable(),
        thumbnail: z.string().nullable(),
        salePrice: z.number(),
        categoryId: z.string().nullable(),
        categoryName: z.string().nullable(),
      }),
    ),
  )
  .handler(async ({ input, context, errors }) => {
    const org = await requireMemberOfOrgSlug({
      orgSlug: input.orgSlug,
      userId: context.user.id,
      errors,
    });

    const products = await prisma.product.findMany({
      where: { organizationId: org.id, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        prepTimeMinutes: true,
        thumbnail: true,
        salePrice: true,
        categoryId: true,
        category: { select: { name: true } },
      },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      prepTimeMinutes: product.prepTimeMinutes,
      thumbnail: product.thumbnail || null,
      salePrice: Number(product.salePrice),
      categoryId: product.categoryId,
      categoryName: product.category?.name ?? null,
    }));
  });
