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

export const metadata: Metadata = {
  title: "Catálogo de ofertas",
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
