import { ShopperScan } from "@/features/shopper/components/shopper-scan";

interface Props {
  params: Promise<{ orgSlug: string; storeId: string }>;
}

// Escaneamento público (sem login) de produto na loja.
export default async function ShopperScanPage({ params }: Props) {
  const { orgSlug, storeId } = await params;
  return <ShopperScan orgSlug={orgSlug} storeId={storeId} />;
}
