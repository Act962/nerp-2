import { TradeGramStore } from "@/features/tradegram/components/tradegram-store";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string; storeId: string }>;
}

export const metadata: Metadata = {
  title: "TradeGram",
};

// Página pública de uma loja: quadros por tipo de mídia (TradeGram).
export default async function TradeGramStorePage({ params }: Props) {
  const { slug: orgSlug, storeId } = await params;
  return <TradeGramStore orgSlug={orgSlug} storeId={storeId} />;
}
