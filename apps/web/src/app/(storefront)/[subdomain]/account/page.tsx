import type { Metadata } from "next";
import { ROBOTS_TELA_DE_APP } from "@/features/storefront/lib/seo";
import { AccountPage } from "@/features/storefront/components/acconut";

/**
 * Área logada do cliente da loja.
 *
 * `follow` continua ligado: os links daqui para o catálogo seguem valendo.
 */
export const metadata: Metadata = {
  title: "Minha conta",
  robots: ROBOTS_TELA_DE_APP,
};

interface AccountPageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function Page({ params }: AccountPageProps) {
  const { subdomain } = await params;
  return (
    <main className="max-w-3xl mx-auto w-full px-6">
      <AccountPage subdomain={subdomain} />
    </main>
  );
}
