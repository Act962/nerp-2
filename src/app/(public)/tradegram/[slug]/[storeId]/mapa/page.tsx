import { TradeGramMap } from "@/features/tradegram/components/tradegram-map";
import { Suspense } from "react";

interface Props {
  params: Promise<{ slug: string; storeId: string }>;
}

// Mapa Konva público read-only de uma loja, filtrado por ?media=<code>.
export default async function TradeGramMapPage({ params }: Props) {
  const { slug: orgSlug, storeId } = await params;
  return (
    <Suspense>
      <TradeGramMap orgSlug={orgSlug} storeId={storeId} />
    </Suspense>
  );
}
