import type { Metadata } from "next";
import { ROBOTS_TELA_DE_APP } from "@/features/tradegram/lib/seo";
import { ShopperAuth } from "@/features/shopper/components/shopper-auth";
import { Suspense } from "react";

/**
 * Login do cliente final: porta de entrada, não conteúdo.
 *
 * `follow` fica ligado: os links daqui levam a perfis, que são conteúdo.
 */
export const metadata: Metadata = {
  title: "Entrar — TradeGram",
  robots: ROBOTS_TELA_DE_APP,
};

interface Props {
  searchParams: Promise<{ redirect?: string }>;
}

// Login/cadastro do cliente final (global, cross-loja).
export default async function ShopperEntrarPage({ searchParams }: Props) {
  const { redirect } = await searchParams;
  return (
    <Suspense>
      <ShopperAuth redirectTo={redirect} />
    </Suspense>
  );
}
