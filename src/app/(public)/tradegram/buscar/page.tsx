import { TradeGramSearch } from "@/features/tradegram/components/tradegram-search";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buscar — TradeGram",
};

// Busca pública cross-org do TradeGram: grupos, lojas e indústrias.
export default function TradeGramSearchPage() {
  return <TradeGramSearch />;
}
