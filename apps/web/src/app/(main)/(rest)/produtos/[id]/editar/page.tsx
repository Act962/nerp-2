import { EditProductForm } from "./edit-product-form";
import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { orpc } from "@/lib/orpc";

type ProductPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function Page({ params }: ProductPageProps) {
  const queryClient = getQueryClient();
  const { id: productId } = await params;

  await queryClient.prefetchQuery(
    orpc.products.get.queryOptions({
      input: {
        id: productId,
      },
    }),
  );

  return (
    <HydrateClient client={queryClient}>
      <EditProductForm />
    </HydrateClient>
  );
}
