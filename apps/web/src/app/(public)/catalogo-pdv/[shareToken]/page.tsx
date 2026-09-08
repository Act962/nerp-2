import type { Metadata } from "next";
import { PublicCatalogView } from "@/features/pdv-catalog/components/public-catalog-view";

interface Props {
  params: Promise<{ shareToken: string }>;
}

/*
  `noindex`: o endereço É a credencial.

  Esta página abre com um token na URL e sem login. Um link que vaze — colado
  num grupo, num e-mail que virou página web, numa barra de endereço com
  sincronização ligada — pode ser rastreado, e aí o "link secreto" passa a
  estar no índice do Google, achável por qualquer um.

  A raiz do app já é `noindex` por padrão (ver `src/app/layout.tsx`), mas aqui
  o valor é declarado de novo, de propósito: quem um dia mudar o padrão da raiz
  não pode levar estas páginas junto sem perceber.

  `follow: false` acompanha: os links de dentro apontam para dados da mesma
  organização.
*/
export const metadata: Metadata = {
  title: "Catálogo PDV",
  robots: { index: false, follow: false },
};

// Rota pública/deslogada do catálogo de PDV: o Trade Marketing envia esse
// link pra fornecedores/indústrias verem as oportunidades ou baixarem o PDF.
export default async function CatalogoPdvPublicoPage({ params }: Props) {
  const { shareToken } = await params;
  return <PublicCatalogView shareToken={shareToken} />;
}
