import type { Metadata } from "next";
import { ROBOTS_TELA_DE_APP } from "@/features/tradegram/lib/seo";
import { TradeGramMap } from "@/features/tradegram/components/tradegram-map";
import { Suspense } from "react";

/**
 * O mapa é um canvas: o que ele desenha não existe como texto.
 *
 * `follow` fica ligado: os links daqui levam a perfis, que são conteúdo.
 */
export const metadata: Metadata = {
  title: "Mapa da loja — TradeGram",
  robots: ROBOTS_TELA_DE_APP,
};

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
