import type { Metadata } from "next";
import { TradeGramSlugRouter } from "@/features/tradegram/components/tradegram-slug-router";
import {
  ROBOTS_PUBLICO,
  tradegramCanonical,
} from "@/features/tradegram/lib/seo";
import prisma from "@/lib/db";
import { client } from "@/lib/orpc";

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * O metadata de `/tradegram/<slug>`.
 *
 * Era `title: "TradeGram"`, fixo, para todo grupo e toda loja do país. Como o
 * conteúdo desta página é montado no navegador, o título e a descrição são
 * literalmente a única coisa que o rastreador lê — deixá-los iguais em todos os
 * perfis anula o pouco que existe.
 *
 * Quem decide se o slug é um grupo ou uma loja continua sendo a procedure
 * `resolveSlug`, e não uma cópia da regra aqui: a precedência tem exceções
 * (uma organização criada depois com o mesmo slug de uma loja) que estão
 * documentadas lá. Aqui só se pergunta o nome do que ela resolveu.
 *
 * `NOT_FOUND` vira `noindex`. Hoje a página responde 200 com "não encontramos
 * esta página" — um soft-404, que é o tipo de endereço que entra no índice como
 * lixo. O `noindex` é o remendo certo enquanto a página não devolver 404.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  let alvo: { kind: string; orgSlug: string | null; storeId: string | null };
  try {
    alvo = await client.tradegramPublic.resolveSlug({ slug });
  } catch {
    return { title: "TradeGram", robots: { index: false, follow: true } };
  }

  if (alvo.kind === "NOT_FOUND" || !alvo.orgSlug) {
    return { title: "TradeGram", robots: { index: false, follow: true } };
  }

  // Só o nome. As procedures `group` e `store` devolvem estatísticas e o mapa
  // inteiro da loja — carga que a `<head>` não tem o que fazer com.
  const nome =
    alvo.kind === "STORE" && alvo.storeId
      ? await prisma.store.findUnique({
          where: { id: alvo.storeId },
          select: { name: true, city: true, state: true },
        })
      : await prisma.organization.findUnique({
          where: { slug: alvo.orgSlug },
          select: { name: true, city: true, state: true },
        });

  if (!nome)
    return { title: "TradeGram", robots: { index: false, follow: true } };

  const praca = [nome.city, nome.state].filter(Boolean).join(" — ");
  const ehLoja = alvo.kind === "STORE";
  const titulo = praca
    ? `${nome.name} (${praca}) | TradeGram`
    : `${nome.name} | TradeGram`;
  const descricao = ehLoja
    ? `${nome.name} no TradeGram: espaços, mídias e oportunidades do ponto de venda${praca ? ` em ${praca}` : ""}.`
    : `${nome.name} no TradeGram: as lojas do grupo e a presença delas no mapa do varejo${praca ? ` em ${praca}` : ""}.`;
  const canonical = tradegramCanonical(`/tradegram/${slug}`);

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
 * `/tradegram/<slug>` é ambíguo: pode ser uma organização ou uma loja.
 *
 * Os dois compartilham o segmento de propósito — é o que dá uma URL curta e
 * legível para os dois. Quem desempata é o servidor, e a organização vence.
 */
export default async function TradeGramSlugPage({ params }: Props) {
  const { slug } = await params;
  return <TradeGramSlugRouter slug={slug} />;
}
