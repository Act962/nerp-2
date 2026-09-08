import { ROBOTS_TELA_DE_APP } from "@/features/tradegram/lib/seo";
import { TradeGramSearch } from "@/features/tradegram/components/tradegram-search";
import type { Metadata } from "next";

/**
 * A busca não tem conteúdo próprio: o que ela mostra muda a cada consulta.
 *
 * `follow` fica ligado: os links daqui levam a perfis, que são conteúdo.
 */
export const metadata: Metadata = {
  title: "Buscar — TradeGram",
  robots: ROBOTS_TELA_DE_APP,
};

// Busca pública cross-org do TradeGram: grupos, lojas e indústrias.
export default function TradeGramSearchPage() {
  return <TradeGramSearch />;
}
