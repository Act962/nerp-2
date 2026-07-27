import { TradeGramGroup } from "@/features/tradegram/components/tradegram-group";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export const metadata: Metadata = {
  title: "TradeGram",
};

// Feed público do grupo (TradeGram). Sem login — a org é resolvida pelo slug e
// só responde se o perfil público estiver ligado.
export default async function TradeGramGroupPage({ params }: Props) {
  const { orgSlug } = await params;
  return <TradeGramGroup orgSlug={orgSlug} />;
}
