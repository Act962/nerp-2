import { PageHeader } from "@/components/page-header";
import { Coletor } from "@/features/stock/components/coletor";
import { EstoqueTabs } from "@/features/stock/components/estoque-tabs";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("estoque");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coletor"
        description="Bipe o produto e registre entrada, saída ou contagem de inventário"
      />
      <EstoqueTabs />
      <Coletor />
    </div>
  );
}
