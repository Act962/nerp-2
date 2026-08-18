import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { ProductsContainer } from "@/features/products/components/products-container";
import { orpc } from "@/lib/orpc";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("produtos");
  return (
    <div className="h-full">
      <ProductsContainer />
    </div>
  );
}
