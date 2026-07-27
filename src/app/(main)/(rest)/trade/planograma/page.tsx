import { PageHeader } from "@/components/page-header";
import { requireTradeAccess } from "@/features/billing/lib/require-trade-access";
import { PlanogramList } from "@/features/planogram/components/planogram-list";

export default async function PlanogramaPage() {
  await requireTradeAccess("planograma");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planograma"
        description="Monte a exposição dos produtos na gôndola e distribua para as lojas."
      />
      <PlanogramList />
    </div>
  );
}
