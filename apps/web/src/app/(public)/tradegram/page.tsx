import type { Metadata } from "next";
import { TradeGramExplorer } from "@/features/tradegram/components/tradegram-explorer";
import {
  ROBOTS_PUBLICO,
  tradegramCanonical,
} from "@/features/tradegram/lib/seo";

/**
 * A raiz do TradeGram público.
 *
 * `robots` explícito: a raiz do `apps/web` é `noindex` por padrão porque quase
 * tudo lá é tela de sistema. O TradeGram é a exceção — é conteúdo aberto, e
 * quer ser achado.
 */
export const metadata: Metadata = {
  title: "TradeGram — o mapa do trade marketing do Brasil",
  description:
    "Encontre supermercados, redes e pontos de venda no mapa. Sem login.",
  robots: ROBOTS_PUBLICO,
  alternates: { canonical: tradegramCanonical("/tradegram") },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "TradeGram",
    title: "TradeGram — o mapa do trade marketing do Brasil",
    description:
      "Encontre supermercados, redes e pontos de venda no mapa. Sem login.",
    url: tradegramCanonical("/tradegram"),
  },
  twitter: {
    card: "summary",
    title: "TradeGram — o mapa do trade marketing do Brasil",
    description:
      "Encontre supermercados, redes e pontos de venda no mapa. Sem login.",
  },
};

export default function TradeGramHomePage() {
  return <TradeGramExplorer />;
}
