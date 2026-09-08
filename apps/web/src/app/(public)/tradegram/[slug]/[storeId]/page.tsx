import type { Metadata } from "next";
import { TradeGramStore } from "@/features/tradegram/components/tradegram-store";
import {
  ROBOTS_PUBLICO,
  tradegramCanonical,
} from "@/features/tradegram/lib/seo";
import prisma from "@/lib/db";

interface Props {
  params: Promise<{ slug: string; storeId: string }>;
}

/**
 * O metadata da página de uma loja.
 *
 * Duas coisas acontecem aqui, e a segunda é a que importa.
 *
 * **Título próprio.** Era `"TradeGram"`, fixo, para toda loja do país.
 *
 * **Canonical para a URL curta.** A MESMA loja responde em dois endereços:
 * aqui, por `<slugDaOrg>/<storeId>`, e em `/tradegram/<slugDaLoja>`, porque o
 * despachante de `[slug]` também resolve loja. Duas URLs com o mesmo conteúdo
 * fazem o buscador escolher uma por conta própria e dividir a autoridade entre
 * as duas. O canonical aponta para a curta — que é a compartilhável, e a que a
 * loja divulga.
 *
 * Sem `noindex` junto: `noindex` e `canonical` na mesma página se contradizem
 * (um manda remover, o outro manda consolidar) e o Google avisa isso no Search
 * Console. Para conteúdo duplicado, o canonical sozinho é a resposta certa.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: orgSlug, storeId } = await params;

  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      isActive: true,
      organization: { slug: orgSlug, isPublicProfile: true },
    },
    select: { name: true, slug: true, city: true, state: true },
  });

  if (!store) {
    return { title: "TradeGram", robots: { index: false, follow: true } };
  }

  const praca = [store.city, store.state].filter(Boolean).join(" — ");
  const titulo = praca
    ? `${store.name} (${praca}) | TradeGram`
    : `${store.name} | TradeGram`;
  const descricao = `${store.name} no TradeGram: espaços, mídias e oportunidades do ponto de venda${praca ? ` em ${praca}` : ""}.`;

  // A URL curta só existe se a loja tiver slug; sem ele, esta é a canônica.
  const canonical = tradegramCanonical(
    store.slug
      ? `/tradegram/${store.slug}`
      : `/tradegram/${orgSlug}/${storeId}`,
  );

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

// Página pública de uma loja: quadros por tipo de mídia (TradeGram).
export default async function TradeGramStorePage({ params }: Props) {
  const { slug: orgSlug, storeId } = await params;
  return <TradeGramStore orgSlug={orgSlug} storeId={storeId} />;
}
