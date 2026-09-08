import type { Metadata } from "next";
import { ROBOTS_TELA_DE_APP } from "@/features/tradegram/lib/seo";
import { ShopperScan } from "@/features/shopper/components/shopper-scan";

/**
 * O leitor de código de barras precisa de uma câmera — não há o que indexar.
 *
 * `follow` fica ligado: os links daqui levam a perfis, que são conteúdo.
 */
export const metadata: Metadata = {
  title: "Escanear produto — TradeGram",
  robots: ROBOTS_TELA_DE_APP,
};

interface Props {
  params: Promise<{ slug: string; storeId: string }>;
}

// Escaneamento público (sem login) de produto na loja.
export default async function ShopperScanPage({ params }: Props) {
  const { slug: orgSlug, storeId } = await params;
  return <ShopperScan orgSlug={orgSlug} storeId={storeId} />;
}
