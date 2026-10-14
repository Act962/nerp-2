import { base } from "@/app/middlewares/base";
import {
  type FiltrosDaLista,
  carregarVitrine,
  contarDaLista,
  paginaDaLista,
  precificar,
} from "@/features/storefront/server/vitrine";
import prisma from "@/lib/db";
import z from "zod";

export const produtoDaVitrineSchema = z.object({
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
  images: z.array(z.string()).nullable(),
  productIsDisponile: z.boolean(),
});

/**
 * Uma página da vitrine. O catálogo grande travava a página buscando, conferindo
 * foto e precificando tudo de uma vez — agora cada rolagem pede a próxima
 * página pelo cursor (o `id` do último produto entregue).
 */
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
      search: z.string().trim().optional(),
      // Quando o storefront tem um `CatalogUser` logado, mandar o id aqui
      // faz a listagem já projetar `salePrice` da tabela desse usuário.
      // Guest = default da org.
      catalogUserId: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(60).default(24),
    }),
  )
  .output(
    z.object({
      products: z.array(produtoDaVitrineSchema),
      nextCursor: z.string().nullable(),
      // Só vem na primeira página: contar a cada rolagem seria uma consulta
      // a mais por página para um número que não muda.
      total: z.number().nullable(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const vitrine = await carregarVitrine(input.subdomain);
    if (!vitrine) throw errors.NOT_FOUND();

    const filtros: FiltrosDaLista = {
      minValue: input.minValue,
      maxValue: input.maxValue,
      search: input.search || undefined,
    };

    if (input.categorySlugs && input.categorySlugs.length > 0) {
      /*
        Filtrar por uma categoria inclui as descendentes: a vitrine mostra só
        as categorias de cima, e o produto costuma estar cadastrado na
        subcategoria. `path` é o caminho de ids ("catA/subB"), então basta
        ver se o id escolhido aparece nele.
      */
      const categories = await prisma.category.findMany({
        where: { organizationId: vitrine.organizationId },
        select: { id: true, slug: true, path: true },
      });
      const escolhidas = categories
        .filter((category) => input.categorySlugs?.includes(category.slug))
        .map((category) => category.id);
      filtros.categoryIds = categories
        .filter((category) =>
          escolhidas.some(
            (id) =>
              category.id === id ||
              (category.path ?? "").split("/").includes(id),
          ),
        )
        .map((category) => category.id);
    }

    const { itens, nextCursor } = await paginaDaLista(
      vitrine,
      filtros,
      input.limit,
      input.cursor,
    );
    const total = input.cursor ? null : await contarDaLista(vitrine, filtros);
    const products = await precificar(vitrine, itens, input.catalogUserId);

    return { products, nextCursor, total };
  });
