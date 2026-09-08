import type { Metadata } from "next";
import { ROBOTS_TELA_DE_APP } from "@/features/storefront/lib/seo";
import { RegisterFormCatalog } from "../../../../features/storefront/components/register-form";

/**
 * Porta de entrada da loja, não conteúdo dela.
 *
 * `follow` continua ligado: os links daqui para o catálogo seguem valendo.
 */
export const metadata: Metadata = {
  title: "Criar conta",
  robots: ROBOTS_TELA_DE_APP,
};

interface RegisterParams {
  params?: Promise<{ subdomain: string }>;
}
export default async function Page({ params }: RegisterParams) {
  const subdomainValue = await params;
  return <RegisterFormCatalog subdomain={subdomainValue?.subdomain} />;
}
