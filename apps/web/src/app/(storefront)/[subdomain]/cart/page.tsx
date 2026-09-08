import type { Metadata } from "next";
import { ROBOTS_TELA_DE_APP } from "@/features/storefront/lib/seo";
import { Cart } from "../../../../features/storefront/components/cart";

/**
 * O carrinho é estado de uma pessoa, não conteúdo — o do rastreador
 * está sempre vazio.
 *
 * `follow` continua ligado: os links daqui para o catálogo seguem valendo.
 */
export const metadata: Metadata = {
  title: "Carrinho",
  robots: ROBOTS_TELA_DE_APP,
};

interface CardProps {
  params: Promise<{ subdomain: string }>;
}

export default async function Page({ params }: CardProps) {
  const { subdomain } = await params;

  return <Cart subdomain={subdomain} />;
}
