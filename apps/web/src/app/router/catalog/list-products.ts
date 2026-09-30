import { base } from "@/app/middlewares/base";
import { conferirFotos, temFoto } from "@/features/storefront/server/tem-foto";
import prisma from "@/lib/db";
import { resolveManyPrices } from "@/features/precos/server/resolve-price";
import { sortProducts } from "@/utils/sorteble-products";
import z, { string } from "zod";

export const listProducts = base
  .route({
    method: "GET",
    summary: "Listar produtos",
    tags: ["products"],
  })
  .input(
    z.object({
      subdomain: z.string(),
      categorySlugs: z.array(z.string()).optional(),
      maxValue: z.number().optional(),
      minValue: z.number().optional(),
      // Quando o storefront tem um `CatalogUser` logado, mandar o id aqui
      // faz a listagem já projetar `salePrice` da tabela desse usuário.
      // Guest = default da org.
      catalogUserId: z.string().optional(),
    }),
  )
  .output(
    z.object({
      categories: z.array(
        z.object({
          id: z.string(),
          isActive: z.boolean(),
          name: z.string(),
          description: z.string().optional(),
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
      products: z.array(
        z.object({
          id: z.string(),
          isActive: z.boolean(),
          organizationId: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          slug: z.string(),
          minStock: z.number(),
          categoryId: z.string().nullable(),
          weight: z.number().nullable(),
          thumbnail: z.string(),
          currentStock: z.number(),
          salePrice: z.number(),
          promotionalPrice: z.number().nullable(),
          images: z.array(string()).nullable(),
          productIsDisponile: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const { subdomain } = input;
      const organization = await prisma.organization.findUnique({
        where: {
          subdomain,
        },
      });
      if (!organization) {
        throw errors.NOT_FOUND();
      }
      const catalogSettings = await prisma.catalogSettings.findUnique({
        where: {
          organizationId: organization.id,
        },
      });
      const categories = await prisma.category.findMany({
        where: {
          organizationId: organization.id,
        },
      });
      // Catálogo público: só produtos ativos E marcados como visíveis.
      // A caixa/PDV pode continuar usando produto ativo sem exibir.
      const visiveis = {
        organizationId: organization.id,
        isActive: true,
        showInCatalog: true,
        ...(catalogSettings?.showProductWithoutStock
          ? {}
          : { currentStock: { gte: 1 } }),
      };

      /*
        Filtrar por uma categoria inclui as descendentes: a vitrine mostra só
        as categorias de cima, e o produto costuma estar cadastrado na
        subcategoria. `path` é o caminho de ids ("catA/subB"), então basta
        ver se o id escolhido aparece nele.
      */
      const escolhidas = categories
        .filter((category) => input.categorySlugs?.includes(category.slug))
        .map((category) => category.id);
      const doFiltro = categories
        .filter((category) =>
          escolhidas.some(
            (id) =>
              category.id === id ||
              (category.path ?? "").split("/").includes(id),
          ),
        )
        .map((category) => category.id);

      const products = await prisma.product.findMany({
        where: {
          ...visiveis,
          ...(input.categorySlugs &&
            input.categorySlugs.length > 0 && {
              categoryId: { in: doFiltro },
            }),
          ...(input.minValue && {
            salePrice: {
              gte: input.minValue,
            },
          }),
          ...(input.maxValue && {
            salePrice: {
              lte: input.maxValue,
            },
          }),
        },
      });

      // A contagem sai dos mesmos produtos que a vitrine mostra: contar pelo
      // banco incluiria os sem foto, e a categoria que só tem esses viraria
      // um cartão que abre uma lista vazia.
      const paraContar = await prisma.product.findMany({
        where: visiveis,
        select: { categoryId: true, thumbnail: true },
      });

      const semFotoFora = catalogSettings?.hideProductsWithoutImage === true;
      if (semFotoFora) {
        await conferirFotos([
          ...products.map((product) => product.thumbnail),
          ...paraContar.map((produto) => produto.thumbnail),
        ]);
      }
      const produtos = semFotoFora
        ? products.filter((product) => temFoto(product.thumbnail))
        : products;
      const porCategoria = new Map<string, number>();
      for (const produto of paraContar) {
        if (!produto.categoryId) continue;
        if (semFotoFora && !temFoto(produto.thumbnail)) continue;
        porCategoria.set(
          produto.categoryId,
          (porCategoria.get(produto.categoryId) ?? 0) + 1,
        );
      }
      const contagem = new Map<string, number>();
      for (const [categoryId, quantidade] of porCategoria) {
        const categoria = categories.find((c) => c.id === categoryId);
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

      // Descobre a `priceListId` do usuário logado (se houver) — guest cai
      // na default. `salePrice` retornado é o resolvido pra qty=1.
      let buyerPriceListId: string | null = null;
      if (input.catalogUserId) {
        const cu = await prisma.catalogUser.findFirst({
          where: { id: input.catalogUserId, organizationId: organization.id },
          select: { priceListId: true },
        });
        buyerPriceListId = cu?.priceListId ?? null;
      }
      const resolved = produtos.length
        ? await resolveManyPrices({
            organizationId: organization.id,
            priceListId: buyerPriceListId,
            items: produtos.map((p) => ({ productId: p.id, quantity: 1 })),
          })
        : [];
      const resolvedById = new Map(
        resolved.map((r) => [r.productId, r.unitPrice]),
      );

      let productList = produtos.map((product) => ({
        id: product.id,
        isActive: product.isActive,
        organizationId: product.organizationId,
        name: product.name,
        description: product.description,
        slug: product.slug,
        minStock: Number(product.minStock),
        categoryId: product.categoryId,
        weight: Number(product.weight),
        thumbnail: product.thumbnail,
        currentStock: Number(product.currentStock),
        salePrice: resolvedById.get(product.id) ?? Number(product.salePrice),
        promotionalPrice: Number(product.promotionalPrice),
        images: product.images,
        productIsDisponile: Number(product.currentStock) > 0,
      }));

      if (catalogSettings?.sortOrder) {
        productList = sortProducts(productList, catalogSettings.sortOrder);
      }

      const categoryList = categories.map((category) => ({
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

      return {
        products: productList,
        categories: categoryList,
      };
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR();
    }
  });
