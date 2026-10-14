import { base } from "@/app/middlewares/base";
import {
  carregarVitrine,
  semOsSemFoto,
} from "@/features/storefront/server/vitrine";
import prisma from "@/lib/db";
import z from "zod";

/**
 * As categorias da vitrine pública, com quantos produtos cada uma mostra.
 * Saiu de `listProducts` quando ela passou a ser paginada: a contagem precisa
 * do catálogo inteiro, a página não — e o cabeçalho, que só quer as
 * categorias, deixou de baixar todos os produtos para pegá-las.
 */
export const listPublicCategories = base
  .route({
    method: "GET",
    summary: "Categorias da vitrine pública",
    tags: ["settings-catalog"],
  })
  .input(z.object({ subdomain: z.string() }))
  .output(
    z.array(
      z.object({
        id: z.string(),
        isActive: z.boolean(),
        name: z.string(),
        slug: z.string(),
        image: z.string().nullable(),
        icon: z.string().nullable(),
        parentId: z.string().nullable(),
        order: z.number(),
        // Produtos visíveis dela e das filhas, sem filtro nenhum aplicado —
        // é o que decide se o cartão da categoria aparece na vitrine.
        productCount: z.number(),
      }),
    ),
  )
  .handler(async ({ input, errors }) => {
    const vitrine = await carregarVitrine(input.subdomain);
    if (!vitrine) throw errors.NOT_FOUND();

    const categories = await prisma.category.findMany({
      where: { organizationId: vitrine.organizationId },
      select: {
        id: true,
        isActive: true,
        name: true,
        slug: true,
        image: true,
        icon: true,
        parentId: true,
        order: true,
        path: true,
      },
    });

    // A contagem sai dos mesmos produtos que a vitrine mostra: contar pelo
    // banco incluiria os sem foto, e a categoria que só tem esses viraria
    // um cartão que abre uma lista vazia.
    const paraContar = await semOsSemFoto(
      await prisma.product.findMany({
        where: { ...vitrine.visiveis, categoryId: { not: null } },
        select: { categoryId: true, thumbnail: true },
      }),
    );

    const porCategoria = new Map<string, number>();
    for (const produto of paraContar) {
      if (!produto.categoryId) continue;
      porCategoria.set(
        produto.categoryId,
        (porCategoria.get(produto.categoryId) ?? 0) + 1,
      );
    }
    const porId = new Map(
      categories.map((category) => [category.id, category]),
    );
    const contagem = new Map<string, number>();
    for (const [categoryId, quantidade] of porCategoria) {
      const categoria = porId.get(categoryId);
      if (!categoria) continue;
      // Soma na própria categoria e em cada ancestral do caminho.
      const caminho = new Set([
        categoria.id,
        ...(categoria.path ?? "").split("/").filter(Boolean),
      ]);
      for (const id of caminho) {
        contagem.set(id, (contagem.get(id) ?? 0) + quantidade);
      }
    }

    return categories.map((category) => ({
      id: category.id,
      isActive: category.isActive,
      name: category.name,
      slug: category.slug,
      image: category.image,
      icon: category.icon,
      parentId: category.parentId,
      order: Number(category.order),
      productCount: contagem.get(category.id) ?? 0,
    }));
  });
