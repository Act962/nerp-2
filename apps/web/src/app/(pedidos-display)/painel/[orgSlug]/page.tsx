import type { Metadata } from "next";
import { TvDisplay } from "@/features/pedidos/components/tv-display";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export const metadata: Metadata = {
  title: "Painel de pedidos prontos",
};

// Rota pública (sem requireAuth): a confiança vem do orgSlug na URL, mesmo
// modelo do storefront/checkout. Exibe apenas mesa + prato, nada sensível.
export default async function PainelTvPage({ params }: Props) {
  const { orgSlug } = await params;

  return <TvDisplay orgSlug={orgSlug} />;
}
