import type { Metadata } from "next";
import { ROBOTS_TELA_DE_APP } from "@/features/storefront/lib/seo";
import { LoginFormCatalog } from "../../../../features/storefront/components/login-form";

/**
 * Porta de entrada da loja, não conteúdo dela.
 *
 * `follow` continua ligado: os links daqui para o catálogo seguem valendo.
 */
export const metadata: Metadata = {
  title: "Entrar",
  robots: ROBOTS_TELA_DE_APP,
};

interface LoginParams {
  params?: Promise<{ subdomain: string }>;
}
export default async function Page({ params }: LoginParams) {
  const subdomainValue = await params;
  return <LoginFormCatalog subdomain={subdomainValue?.subdomain} />;
}
