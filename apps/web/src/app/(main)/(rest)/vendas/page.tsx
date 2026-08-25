import { SalesPage } from "@/features/sales/components/sales";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("vendas");
  return (
    <>
      <SalesPage />
    </>
  );
}
