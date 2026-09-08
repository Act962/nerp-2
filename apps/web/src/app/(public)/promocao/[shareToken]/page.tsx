import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { client } from "@/lib/orpc";
import { PublicPromoCatalog } from "@/features/promotional-catalog/components/public-promo-catalog";
import type {
  CatalogConfig,
  CatalogProduct,
} from "@/features/promotional-catalog/types";
import type { DynamicContext } from "@/features/promotional-catalog/lib/resolve-entity";

interface Props {
  params: Promise<{ shareToken: string }>;
}

/*
  `noindex`: o endereço É a credencial.

  Esta página abre com um token na URL e sem login. Um link que vaze — colado
  num grupo, num e-mail que virou página web, numa barra de endereço com
  sincronização ligada — pode ser rastreado, e aí o "link secreto" passa a
  estar no índice do Google, achável por qualquer um.

  A raiz do app já é `noindex` por padrão (ver `src/app/layout.tsx`), mas aqui
  o valor é declarado de novo, de propósito: quem um dia mudar o padrão da raiz
  não pode levar estas páginas junto sem perceber.

  `follow: false` acompanha: os links de dentro apontam para dados da mesma
  organização.
*/
export const metadata: Metadata = {
  title: "Catálogo de ofertas",
  robots: { index: false, follow: false },
};

// Rota PÚBLICA (deslogada) do Catálogo Promocional: aberta pelo link gerado no
// "Compartilhar". Busca por token e renderiza as páginas read-only.
export default async function PromoCatalogPublicPage({ params }: Props) {
  const { shareToken } = await params;

  let data: {
    name: string;
    config: unknown;
    products: CatalogProduct[];
    dynamicEntities: Record<string, unknown>;
  };
  try {
    data = await client.promotionalCatalog.publicGet({ shareToken });
  } catch {
    notFound();
  }

  return (
    <PublicPromoCatalog
      name={data.name}
      config={data.config as CatalogConfig}
      products={data.products}
      dynamicEntities={data.dynamicEntities as Record<string, DynamicContext>}
    />
  );
}
