import { TradeGramSlugRouter } from "@/features/tradegram/components/tradegram-slug-router";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "TradeGram",
};

/**
 * `/tradegram/<slug>` é ambíguo: pode ser uma organização ou uma loja.
 *
 * Os dois compartilham o segmento de propósito — é o que dá uma URL curta e
 * legível para os dois. Quem desempata é o servidor, e a organização vence.
 */
export default async function TradeGramSlugPage({ params }: Props) {
  const { slug } = await params;
  return <TradeGramSlugRouter slug={slug} />;
}
