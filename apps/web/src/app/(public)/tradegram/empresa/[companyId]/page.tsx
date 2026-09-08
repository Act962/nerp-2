import type { Metadata } from "next";
import { TradeGramCompany } from "@/features/tradegram/components/tradegram-company";
import {
  ROBOTS_PUBLICO,
  tradegramCanonical,
} from "@/features/tradegram/lib/seo";
import { client } from "@/lib/orpc";

interface Props {
  params: Promise<{ companyId: string }>;
}

/**
 * O metadata do perfil de uma empresa.
 *
 * Era `title: "TradeGram"`, fixo — o mesmo título para TODAS as empresas do
 * catálogo. Num diretório, onde o valor está justamente em cada perfil ser
 * distinto, isso é a diferença entre milhares de páginas indistinguíveis e
 * milhares de páginas que respondem a uma busca por nome de empresa.
 *
 * A consulta é a mesma procedure que a página usa; o custo é um ida-e-volta
 * que o Next já faz no servidor.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { companyId } = await params;

  let header: {
    name: string;
    tradeName: string | null;
    city: string | null;
    state: string | null;
  };
  try {
    ({ header } = await client.tradegramPublic.getPublicCompany({ companyId }));
  } catch {
    // Empresa inexistente ou fora do ar: sem título inventado e sem indexação.
    return { title: "TradeGram", robots: { index: false, follow: true } };
  }

  const nome = header.tradeName || header.name;
  const praca = [header.city, header.state].filter(Boolean).join(" — ");
  const titulo = praca
    ? `${nome} (${praca}) | TradeGram`
    : `${nome} | TradeGram`;
  const descricao = praca
    ? `${nome} no TradeGram: perfil, lojas e presença em ${praca}.`
    : `${nome} no TradeGram: perfil, lojas e presença no mapa do varejo.`;
  const canonical = tradegramCanonical(`/tradegram/empresa/${companyId}`);

  return {
    title: titulo,
    description: descricao,
    robots: ROBOTS_PUBLICO,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "profile",
      locale: "pt_BR",
      siteName: "TradeGram",
      title: titulo,
      description: descricao,
      ...(canonical ? { url: canonical } : {}),
    },
    twitter: { card: "summary", title: titulo, description: descricao },
  };
}

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
