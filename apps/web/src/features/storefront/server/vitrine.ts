import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { CatalogSortOrder } from "@/generated/prisma/enums";
import { resolveManyPrices } from "@/features/precos/server/resolve-price";
import { conferirFotos, temFoto } from "@/features/storefront/server/tem-foto";
import prisma from "@/lib/db";

/** O que a vitrine pública precisa saber da loja antes de listar qualquer coisa. */
export type Vitrine = {
  organizationId: string;
  sortOrder: CatalogSortOrder;
  semFotoFora: boolean;
  visiveis: Prisma.ProductWhereInput;
};

export async function carregarVitrine(
  subdomain: string,
): Promise<Vitrine | null> {
  const organization = await prisma.organization.findUnique({
    where: { subdomain },
    select: { id: true },
  });
  if (!organization) return null;

  const settings = await prisma.catalogSettings.findUnique({
    where: { organizationId: organization.id },
    select: {
      sortOrder: true,
      showProductWithoutStock: true,
      hideProductsWithoutImage: true,
    },
  });

  return {
    organizationId: organization.id,
    sortOrder: settings?.sortOrder ?? "ASC",
    semFotoFora: settings?.hideProductsWithoutImage === true,
    // Catálogo público: só produtos ativos E marcados como visíveis.
    // A caixa/PDV pode continuar usando produto ativo sem exibir.
    visiveis: {
      organizationId: organization.id,
      isActive: true,
      showInCatalog: true,
      ...(settings?.showProductWithoutStock
        ? {}
        : { currentStock: { gte: 1 } }),
    },
  };
}

/**
 * A ordem vai para o banco porque a lista é paginada: ordenar a página depois
 * de buscá-la embaralharia a sequência entre uma página e outra. O `id` no fim
 * desempata nomes iguais — sem ele o cursor pode pular ou repetir produto.
 */
export function ordemDaVitrine(
  sortOrder: CatalogSortOrder,
): Prisma.ProductOrderByWithRelationInput[] {
  const principal: Prisma.ProductOrderByWithRelationInput =
    sortOrder === "DESC"
      ? { name: "desc" }
      : sortOrder === "NEWEST"
        ? { createdAt: "desc" }
        : sortOrder === "OLDEST"
          ? { createdAt: "asc" }
          : { name: "asc" };
  return [principal, { id: "asc" }];
}

/** Prepara o termo para `unaccent(lower(...)) ILIKE unaccent(?)`. */
function termoDoLike(termo: string): string {
  const escapado = termo.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escapado}%`;
}

/**
 * Ids dos produtos da org cujo nome casa com a busca, ignorando acento e
 * caixa ("acucar" acha "Açúcar"). O Prisma não expõe `unaccent`, então o
 * casamento sai em SQL e o resto do filtro continua no query builder.
 */
export async function idsDaBusca(
  organizationId: string,
  termo: string,
): Promise<string[]> {
  const like = termoDoLike(termo);
  const linhas = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM products
    WHERE "organizationId" = ${organizationId}
      AND unaccent(lower(name)) ILIKE unaccent(${like})
  `;
  return linhas.map((linha) => linha.id);
}

const camposDoCartao = {
  id: true,
  isActive: true,
  organizationId: true,
  name: true,
  description: true,
  slug: true,
  minStock: true,
  categoryId: true,
  weight: true,
  thumbnail: true,
  currentStock: true,
  salePrice: true,
  promotionalPrice: true,
  images: true,
} satisfies Prisma.ProductSelect;

type LinhaDoCartao = Prisma.ProductGetPayload<{
  select: typeof camposDoCartao;
}>;

export type ProdutoDaVitrine = {
  id: string;
  isActive: boolean;
  organizationId: string;
  name: string;
  description: string | null;
  slug: string;
  minStock: number;
  categoryId: string | null;
  weight: number | null;
  thumbnail: string;
  currentStock: number;
  salePrice: number;
  promotionalPrice: number | null;
  images: string[] | null;
  productIsDisponile: boolean;
};

export async function buscarProdutosDaVitrine(args: {
  where: Prisma.ProductWhereInput;
  orderBy: Prisma.ProductOrderByWithRelationInput[];
  take?: number;
  cursor?: string;
}): Promise<LinhaDoCartao[]> {
  return prisma.product.findMany({
    where: args.where,
    orderBy: args.orderBy,
    select: camposDoCartao,
    ...(args.take !== undefined && { take: args.take }),
    ...(args.cursor && { cursor: { id: args.cursor }, skip: 1 }),
  });
}

/** Tira os produtos sem foto quando a loja pediu, conferindo só os recebidos. */
export async function semOsSemFoto<T extends { thumbnail: string }>(
  vitrine: Vitrine,
  produtos: T[],
): Promise<T[]> {
  if (!vitrine.semFotoFora) return produtos;
  await conferirFotos(produtos.map((produto) => produto.thumbnail));
  return produtos.filter((produto) => temFoto(produto.thumbnail));
}

/**
 * Projeta o `salePrice` da tabela do comprador. Com `catalogUserId` vale a
 * `priceListId` dele; guest cai na default. O preço é o resolvido pra qty=1.
 */
export async function precificar(
  vitrine: Vitrine,
  produtos: LinhaDoCartao[],
  catalogUserId: string | undefined,
): Promise<ProdutoDaVitrine[]> {
  if (produtos.length === 0) return [];

  let priceListId: string | null = null;
  if (catalogUserId) {
    const comprador = await prisma.catalogUser.findFirst({
      where: { id: catalogUserId, organizationId: vitrine.organizationId },
      select: { priceListId: true },
    });
    priceListId = comprador?.priceListId ?? null;
  }

  const resolvidos = await resolveManyPrices({
    organizationId: vitrine.organizationId,
    priceListId,
    items: produtos.map((produto) => ({ productId: produto.id, quantity: 1 })),
  });
  const precoPorId = new Map(
    resolvidos.map((resolvido) => [resolvido.productId, resolvido.unitPrice]),
  );

  return produtos.map((produto) => ({
    id: produto.id,
    isActive: produto.isActive,
    organizationId: produto.organizationId,
    name: produto.name,
    description: produto.description,
    slug: produto.slug,
    minStock: Number(produto.minStock),
    categoryId: produto.categoryId,
    weight: Number(produto.weight),
    thumbnail: produto.thumbnail,
    currentStock: Number(produto.currentStock),
    salePrice: precoPorId.get(produto.id) ?? Number(produto.salePrice),
    promotionalPrice: Number(produto.promotionalPrice),
    images: produto.images,
    productIsDisponile: Number(produto.currentStock) > 0,
  }));
}
