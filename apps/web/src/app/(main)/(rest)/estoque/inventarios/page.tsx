import { PageHeader } from "@/components/page-header";
import { EstoqueTabs } from "@/features/stock/components/estoque-tabs";
import { InventoryList } from "@/features/stock/components/inventory-list";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("estoque");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventários"
        description="Contagens de estoque, divergências e aplicação"
      />
      <EstoqueTabs />
      <InventoryList />
    </div>
  );
}
