import type { Metadata } from "next";
import { ROBOTS_TELA_DE_APP } from "@/features/tradegram/lib/seo";
import { ShopperProduct } from "@/features/shopper/components/shopper-product";

/**
 * Uma página por código de barras e por loja: muitas URLs quase iguais, cada
 * uma com pouco a dizer. É volume sem conteúdo, que é o que dilui um domínio.
 *
 * `follow` fica ligado: os links daqui levam a perfis, que são conteúdo.
 */
export const metadata: Metadata = {
  title: "Produto — TradeGram",
  robots: ROBOTS_TELA_DE_APP,
};

interface Props {
  params: Promise<{ slug: string; storeId: string; barcode: string }>;
}

// Produto escaneado (público): preço/oferta/info + "onde está" no mapa.
export default async function ShopperProductPage({ params }: Props) {
  const { slug: orgSlug, storeId, barcode } = await params;
  return (
    <ShopperProduct orgSlug={orgSlug} storeId={storeId} barcode={barcode} />
  );
}
