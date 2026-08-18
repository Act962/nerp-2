import { getQueryClient, HydrateClient } from "@/lib/query/hydration";

import { orpc } from "@/lib/orpc";
import { CheckoutPage } from "../../../../features/storefront/components/checkout";

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
