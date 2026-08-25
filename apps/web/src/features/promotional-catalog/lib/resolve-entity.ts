import { unitLabel } from "@/features/products/lib/units";
import type {
  CatalogPage,
  CatalogProduct,
  ImageBinding,
  TextBinding,
} from "../types";

// Resolução de variáveis de PÁGINA DINÂMICA. Puro (sem React/DOM) — importável
// pelo render do cliente E pelo servidor (`public-get.ts`). Um `DynamicContext`
// carrega as fatias de entidade já resolvidas; os resolvers só fazem lookup.

// Formatador BRL local (evita importar de um arquivo de componente cliente).
function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export type DynamicContext = {
  store?: {
    name: string;
    code: string | null;
    city: string | null;
    state: string | null;
    coverImageKey: string | null;
  };
  org?: {
    name: string;
    tradeName: string | null;
    sigla: string | null;
    city: string | null;
    state: string | null;
    logo: string | null;
  };
  product?: CatalogProduct;
  user?: {
    name: string;
    email: string | null;
    whatsapp: string | null;
    image: string | null;
  };
};

// Texto de uma variável. `null` quando a entidade/fatia não está disponível —
// o chamador cai no texto estático do elemento (placeholder/fallback).
export function resolveEntityText(
  binding: TextBinding,
  ctx: DynamicContext,
): string | null {
  switch (binding.variable) {
    case "store.name":
      return ctx.store?.name ?? null;
    case "store.code":
      return ctx.store?.code ?? null;
    case "store.city":
      return ctx.store?.city ?? null;
    case "store.state":
      return ctx.store?.state ?? null;
    case "org.name":
      return ctx.org?.name ?? null;
    case "org.tradeName":
      return ctx.org?.tradeName ?? null;
    case "org.sigla":
      return ctx.org?.sigla ?? null;
    case "org.city":
      return ctx.org?.city ?? null;
    case "org.state":
      return ctx.org?.state ?? null;
    case "product.name":
      return ctx.product?.name ?? null;
    case "product.sku":
      return ctx.product?.sku ?? null;
    case "product.priceActive":
      return ctx.product
        ? formatBRL(ctx.product.promotionalPrice ?? ctx.product.salePrice)
        : null;
    case "product.unit":
      return ctx.product ? unitLabel(ctx.product.unit) : null;
    case "user.name":
      return ctx.user?.name ?? null;
    case "user.email":
      return ctx.user?.email ?? null;
    case "user.whatsapp":
      return ctx.user?.whatsapp ?? null;
    default:
      return null;
  }
}

// Chave R2 (ou URL absoluta, no caso de user.image) da imagem de uma variável.
// `null` = sem imagem → o chamador cai no `assetKey` placeholder do overlay.
export function resolveEntityImageKey(
  binding: ImageBinding,
  ctx: DynamicContext,
): string | null {
  switch (binding.variable) {
    case "store.coverImage":
      return ctx.store?.coverImageKey ?? null;
    case "org.logo":
      return ctx.org?.logo ?? null;
    case "product.thumbnail":
      return ctx.product?.thumbnail || null;
    case "user.image":
      return ctx.user?.image ?? null;
    default:
      return null;
  }
}

const norm = (s: string) => s.trim().toLowerCase();

// Casa uma loja pelo NOME da página (exato, senão "contém"). Espelha a intenção
// do `matchStoresByName` do servidor, para o editor casar client-side.
export function matchStoreByName<T extends { name: string }>(
  stores: T[],
  pageName: string,
): T | undefined {
  const n = norm(pageName);
  if (!n) return undefined;
  return (
    stores.find((s) => norm(s.name) === n) ??
    stores.find((s) => norm(s.name).includes(n) || n.includes(norm(s.name)))
  );
}

// Monta o contexto de entidades de UMA página (usado no editor). A org é sempre
// disponível (implícita); a loja casa por `refId` ou pelo nome da página;
// produto por `refId`; usuário = usuário da sessão (fase 1).
export function buildDynamicContext(
  dynamic: CatalogPage["dynamic"],
  pageName: string,
  sources: {
    stores: (DynamicContext["store"] & { id: string })[];
    org?: DynamicContext["org"] | null;
    sessionUser?: DynamicContext["user"] | null;
    products: CatalogProduct[];
  },
): DynamicContext {
  if (!dynamic) return {};
  const ctx: DynamicContext = {};
  if (sources.org) ctx.org = sources.org;
  if (dynamic.type === "store") {
    const store = dynamic.refId
      ? sources.stores.find((s) => s.id === dynamic.refId)
      : matchStoreByName(sources.stores, pageName);
    if (store) ctx.store = store;
  } else if (dynamic.type === "product") {
    if (dynamic.refId)
      ctx.product = sources.products.find((p) => p.id === dynamic.refId);
  } else if (dynamic.type === "user") {
    if (sources.sessionUser) ctx.user = sources.sessionUser;
  }
  return ctx;
}
