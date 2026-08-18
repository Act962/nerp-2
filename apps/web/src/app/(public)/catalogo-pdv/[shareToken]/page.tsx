import type { Metadata } from "next";
import { PublicCatalogView } from "@/features/pdv-catalog/components/public-catalog-view";

interface Props {
  params: Promise<{ shareToken: string }>;
}

export const metadata: Metadata = {
  title: "Catálogo PDV",
};

// Rota pública/deslogada do catálogo de PDV: o Trade Marketing envia esse
// link pra fornecedores/indústrias verem as oportunidades ou baixarem o PDF.
export default async function CatalogoPdvPublicoPage({ params }: Props) {
  const { shareToken } = await params;
  return <PublicCatalogView shareToken={shareToken} />;
}
