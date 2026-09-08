import type { Metadata } from "next";
import { ROBOTS_TELA_DE_APP } from "@/features/storefront/lib/seo";
import { getQueryClient, HydrateClient } from "@/lib/query/hydration";

import { orpc } from "@/lib/orpc";
import { CheckoutPage } from "../../../../features/storefront/components/checkout";

/**
 * Tela de compra: não há o que indexar, e indexá-la ainda gastaria o
 * orçamento de rastreio da loja em páginas que nunca trazem visita.
 *
 * `follow` continua ligado: os links daqui para o catálogo seguem valendo.
 */
export const metadata: Metadata = {
  title: "Finalizar pedido",
  robots: ROBOTS_TELA_DE_APP,
};

interface CheckoutProps {
  params: Promise<{ subdomain: string }>;
}
export default async function Page({ params }: CheckoutProps) {
  const queryClient = getQueryClient();

  const { subdomain } = await params;

  await queryClient.prefetchQuery(
    orpc.catalogSettings.public.queryOptions({
      input: {
        subdomain: subdomain,
      },
    }),
  );

  return (
    <HydrateClient client={queryClient}>
      <CheckoutPage subdomain={subdomain} />
    </HydrateClient>
  );
}
