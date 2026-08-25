import { TradeGramExplorer } from "@/features/tradegram/components/tradegram-explorer";

export const metadata = {
  title: "TradeGram — o mapa do trade marketing do Brasil",
  description:
    "Encontre supermercados, redes e pontos de venda no mapa. Sem login.",
};

export default function TradeGramHomePage() {
  return <TradeGramExplorer />;
}
