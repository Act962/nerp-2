import { ShopperProduct } from "@/features/shopper/components/shopper-product";

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
