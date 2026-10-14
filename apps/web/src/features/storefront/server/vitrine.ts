import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { CatalogSortOrder } from "@/generated/prisma/enums";
import { resolveManyPrices } from "@/features/precos/server/resolve-price";
import { conferirFotos, temFoto } from "@/features/storefront/server/tem-foto";
import prisma from "@/lib/db";

/** O que a vitrine pública precisa saber da loja antes de listar qualquer coisa. */
export type Vitrine = {
  organizationId: string;
  sortOrder: CatalogSortOrder;
  semFotoFora: boolean;
  mostrarSemEstoque: boolean;
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

  const mostrarSemEstoque = settings?.showProductWithoutStock === true;
  return {
    organizationId: organization.id,
    sortOrder: settings?.sortOrder ?? "ASC",
    semFotoFora: settings?.hideProductsWithoutImage === true,
    mostrarSemEstoque,
    // Catálogo público: só produtos ativos E marcados como visíveis.
    // A caixa/PDV pode continuar usando produto ativo sem exibir.
    visiveis: {
      organizationId: organization.id,
      isActive: true,
      showInCatalog: true,
      ...(mostrarSemEstoque ? {} : { currentStock: { gte: 1 } }),
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

/** Prepara o termo para `unaccent(lower(...)) ILIKE unaccent(?)`. */
function termoDoLike(termo: string): string {
  const escapado = termo.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escapado}%`;
}

export type FiltrosDaLista = {
  /** Já com as subcategorias; vazio = nenhuma categoria casou. */
  categoryIds?: string[];
  minValue?: number;
  maxValue?: number;
  search?: string;
};

/**
 * A lista da vitrine em SQL, e não no query builder, por causa da busca: o
 * Prisma não expõe `unaccent` ("acucar" acha "Açúcar"), e buscar antes os ids
 * que casam para mandá-los num `id IN (...)` traria para a memória todos os
 * produtos da busca só para entregar uma página.
 */
function ondeDaLista(vitrine: Vitrine, filtros: FiltrosDaLista): Prisma.Sql {
  const condicoes = [
    Prisma.sql`p."organizationId" = ${vitrine.organizationId}`,
    Prisma.sql`p."isActive" = TRUE`,
    Prisma.sql`p."showInCatalog" = TRUE`,
  ];
  if (!vitrine.mostrarSemEstoque) {
    condicoes.push(Prisma.sql`p."currentStock" >= 1`);
  }
  if (filtros.categoryIds) {
    condicoes.push(
      filtros.categoryIds.length > 0
        ? Prisma.sql`p."categoryId" IN (${Prisma.join(filtros.categoryIds)})`
        : Prisma.sql`FALSE`,
    );
  }
  if (filtros.minValue) {
    condicoes.push(Prisma.sql`p."salePrice" >= ${filtros.minValue}`);
  }
  if (filtros.maxValue) {
    condicoes.push(Prisma.sql`p."salePrice" <= ${filtros.maxValue}`);
  }
  if (filtros.search) {
    condicoes.push(
      Prisma.sql`unaccent(lower(p.name)) ILIKE unaccent(${termoDoLike(filtros.search)})`,
    );
  }
  return Prisma.join(condicoes, " AND ");
}

/** A mesma ordem de `ordemDaVitrine`, para a lista e as ofertas baterem. */
function colunaDaOrdem(sortOrder: CatalogSortOrder): {
  coluna: Prisma.Sql;
  desc: boolean;
} {
  if (sortOrder === "NEWEST") {
    return { coluna: Prisma.raw(`"createdAt"`), desc: true };
  }
  if (sortOrder === "OLDEST") {
    return { coluna: Prisma.raw(`"createdAt"`), desc: false };
  }
  return { coluna: Prisma.raw("name"), desc: sortOrder === "DESC" };
}

/**
 * Um lote da lista, a partir do cursor. A continuação é por keyset — "depois
 * do (valor da ordem, id) do cursor" — porque `OFFSET` relê tudo o que ficou
 * para trás a cada página.
 */
async function loteDaLista(
  vitrine: Vitrine,
  filtros: FiltrosDaLista,
  take: number,
  cursor: string | undefined,
): Promise<LinhaDoCartao[]> {
  const { coluna, desc } = colunaDaOrdem(vitrine.sortOrder);
  let depois = Prisma.empty;
  if (cursor) {
    const doCursor = Prisma.sql`(SELECT ${coluna} FROM products WHERE id = ${cursor})`;
    depois = Prisma.sql`AND (
      p.${coluna} ${Prisma.raw(desc ? "<" : ">")} ${doCursor}
      OR (p.${coluna} = ${doCursor} AND p.id > ${cursor})
    )`;
  }

  const linhas = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id FROM products p
    WHERE ${ondeDaLista(vitrine, filtros)} ${depois}
    ORDER BY p.${coluna} ${Prisma.raw(desc ? "DESC" : "ASC")}, p.id ASC
    LIMIT ${take}
  `;
  const ids = linhas.map((linha) => linha.id);
  if (ids.length === 0) return [];

  const produtos = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: camposDoCartao,
  });
  const porId = new Map(produtos.map((produto) => [produto.id, produto]));
  return ids.flatMap((id) => porId.get(id) ?? []);
}

/** Quantos produtos a lista tem com estes filtros, já sem os sem foto. */
export async function contarDaLista(
  vitrine: Vitrine,
  filtros: FiltrosDaLista,
): Promise<number> {
  const onde = ondeDaLista(vitrine, filtros);
  if (vitrine.semFotoFora) {
    const fotos = await prisma.$queryRaw<{ thumbnail: string }[]>`
      SELECT p.thumbnail FROM products p WHERE ${onde}
    `;
    return (await semOsSemFoto(vitrine, fotos)).length;
  }
  const [{ total }] = await prisma.$queryRaw<{ total: number }[]>`
    SELECT count(*)::int AS total FROM products p WHERE ${onde}
  `;
  return total;
}

export function paginaDaLista(
  vitrine: Vitrine,
  filtros: FiltrosDaLista,
  quantidade: number,
  cursor: string | undefined,
) {
  return coletarPagina({
    quantidade,
    cursor,
    buscarLote: (take, depoisDe) =>
      loteDaLista(vitrine, filtros, take, depoisDe),
    filtrar: (lote) => semOsSemFoto(vitrine, lote),
  });
}

/** Teto de lotes por chamada: o que passar disso fica para a próxima rolagem. */
const MAX_LOTES = 10;

/**
 * Junta `quantidade` itens que passam no `filtrar`, lote a lote. O filtro (foto,
 * preço da oferta) só roda depois da busca, então um lote pode render menos
 * que o pedido — ou nada; parar no primeiro lote entregaria página vazia com
 * produtos de sobra adiante. O cursor é o último produto CONSUMIDO, não o
 * último aprovado, para a próxima página não reler o que já foi descartado.
 */
export async function coletarPagina<
  L extends { id: string },
  T extends { id: string },
>(args: {
  quantidade: number;
  cursor?: string;
  buscarLote: (take: number, cursor: string | undefined) => Promise<L[]>;
  filtrar: (lote: L[]) => Promise<T[]>;
  maxLotes?: number;
}): Promise<{ itens: T[]; nextCursor: string | null }> {
  const itens: T[] = [];
  let cursor = args.cursor;

  for (let lote = 0; lote < (args.maxLotes ?? MAX_LOTES); lote++) {
    // Um a mais que o pedido só para saber se existe continuação.
    const linhas = await args.buscarLote(args.quantidade + 1, cursor);
    const temMais = linhas.length > args.quantidade;
    const crus = linhas.slice(0, args.quantidade);
    const aprovados = new Map(
      (await args.filtrar(crus)).map((item) => [item.id, item]),
    );

    for (const [indice, linha] of crus.entries()) {
      const item = aprovados.get(linha.id);
      if (!item) continue;
      itens.push(item);
      if (itens.length === args.quantidade) {
        const sobrou = indice < crus.length - 1 || temMais;
        return { itens, nextCursor: sobrou ? linha.id : null };
      }
    }

    if (!temMais) return { itens, nextCursor: null };
    cursor = crus.at(-1)?.id;
  }

  return { itens, nextCursor: cursor ?? null };
}
