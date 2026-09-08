import type { Metadata } from "next";
import { ROBOTS_TELA_DE_APP } from "@/features/tradegram/lib/seo";
import { ShopperFavorites } from "@/features/shopper/components/shopper-favorites";

/**
 * Os favoritos são de uma pessoa; para o rastreador a lista está sempre vazia.
 *
 * `follow` fica ligado: os links daqui levam a perfis, que são conteúdo.
 */
export const metadata: Metadata = {
  title: "Favoritos — TradeGram",
  robots: ROBOTS_TELA_DE_APP,
};

// Favoritos do cliente (global).
export default function ShopperFavoritesPage() {
  return <ShopperFavorites />;
}
