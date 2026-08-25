import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { AboutUs } from "../../../../features/storefront/components/about-us";
import { orpc } from "@/lib/orpc";

interface Props {
  params: Promise<{ subdomain: string }>;
}

export default async function Page({ params }: Props) {
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
      <AboutUs subdomain={subdomain} />
    </HydrateClient>
  );
}
