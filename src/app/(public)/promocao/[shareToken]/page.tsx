import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { client } from "@/lib/orpc";
import { PublicPromoCatalog } from "@/features/promotional-catalog/components/public-promo-catalog";
import type {
  CatalogConfig,
  CatalogProduct,
} from "@/features/promotional-catalog/types";

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

  let data: { name: string; config: unknown; products: CatalogProduct[] };
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
    />
  );
}
