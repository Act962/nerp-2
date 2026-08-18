import type { Metadata } from "next";
import { PublicRankingPage } from "@/features/ranking/components/public-ranking-page";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export const metadata: Metadata = {
  title: "Ranking",
};

// Rota pública/deslogada do ranking: painel de TV acessível por link, sem login.
// A org é identificada pelo slug na URL — mesmo modelo do painel do garçom.
export default async function RankingPublicoPage({ params }: Props) {
  const { orgSlug } = await params;
  return <PublicRankingPage orgSlug={orgSlug} />;
}
