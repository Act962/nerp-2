import { TradeGramMediaDetail } from "@/features/tradegram/components/tradegram-media-detail";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string; storeId: string; mediaCode: string }>;
}

export const metadata: Metadata = {
  title: "TradeGram",
};

// Página pública de um tipo de mídia numa loja: as fotos de cada espaço.
export default async function TradeGramMediaPage({ params }: Props) {
  const { slug: orgSlug, storeId, mediaCode } = await params;
  return (
    <TradeGramMediaDetail
      orgSlug={orgSlug}
      storeId={storeId}
      mediaCode={mediaCode}
    />
  );
}
