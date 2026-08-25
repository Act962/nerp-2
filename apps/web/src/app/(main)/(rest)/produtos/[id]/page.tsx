import { orpc } from "@/lib/orpc";
import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { ProductView } from "@/features/products/components/product-view";

const stockHistory = [
  {
    id: 1,
    type: "ENTRADA",
    quantity: 50,
    date: "2024-12-10T14:30:00",
    user: "Admin User",
    note: "Compra fornecedor",
  },
  {
    id: 2,
    type: "VENDA",
    quantity: -2,
    date: "2024-12-10T12:15:00",
    user: "Sistema PDV",
    note: "Venda #1234",
  },
  {
    id: 3,
    type: "AJUSTE",
    quantity: -3,
    date: "2024-12-09T10:45:00",
    user: "João Silva",
    note: "Ajuste de inventário",
  },
  {
    id: 4,
    type: "VENDA",
    quantity: -1,
    date: "2024-12-09T09:20:00",
    user: "Sistema PDV",
    note: "Venda #1232",
  },
  {
    id: 5,
    type: "ENTRADA",
    quantity: 30,
    date: "2024-12-08T16:00:00",
    user: "Admin User",
    note: "Compra fornecedor",
  },
];

type ProductPageProps = {
  params: Promise<{
    id: string;
  }>;
};
export default async function Page({ params }: ProductPageProps) {
  const { id: productId } = await params;
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(
    orpc.products.get.queryOptions({
      input: {
        id: productId,
      },
    }),
  );

  return (
    <HydrateClient client={queryClient}>
      <ProductView history={stockHistory} />
    </HydrateClient>
  );
}
