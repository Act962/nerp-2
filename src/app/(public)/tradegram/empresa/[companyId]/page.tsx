import { TradeGramCompany } from "@/features/tradegram/components/tradegram-company";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ companyId: string }>;
}

export const metadata: Metadata = {
  title: "TradeGram",
};

/**
 * Caminho canônico da empresa do catálogo.
 *
 * Segmento ESTÁTICO (`empresa`) vence `[slug]` no Next, então esta rota convive
 * com o despachante sem ambiguidade — e é a degradação de quem não tem slug.
 */
export default async function TradeGramCompanyPage({ params }: Props) {
  const { companyId } = await params;
  return <TradeGramCompany companyId={companyId} />;
}
