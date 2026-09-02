import { PageHeader } from "@/components/page-header";
import { EstoqueTabs } from "@/features/stock/components/estoque-tabs";
import { PurchasesList } from "@/features/purchases/components/purchases-list";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("estoque");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entradas de nota"
        description="Recebimento de mercadoria do fornecedor: estoque, custo e contas a pagar"
      />
      <EstoqueTabs />
      <PurchasesList />
    </div>
  );
}
