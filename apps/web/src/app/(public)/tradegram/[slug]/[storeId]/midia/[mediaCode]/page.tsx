import { ROBOTS_TELA_DE_APP } from "@/features/tradegram/lib/seo";
import { TradeGramMediaDetail } from "@/features/tradegram/components/tradegram-media-detail";
import type { Metadata } from "next";

/**
 * Detalhe de um tipo de mídia dentro de uma loja: subpágina de um perfil, sem
 * assunto próprio.
 *
 * `follow` fica ligado: os links daqui levam a perfis, que são conteúdo.
 */
export const metadata: Metadata = {
  title: "Mídia da loja — TradeGram",
  robots: ROBOTS_TELA_DE_APP,
};

interface Props {
  params: Promise<{ slug: string; storeId: string; mediaCode: string }>;
}

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
