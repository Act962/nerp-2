import { PageHeader } from "@/components/page-header";
import { PlanogramList } from "@/features/planogram/components/planogram-list";
import { requirePermission } from "@/lib/auth-utils";

export default async function PlanogramaPage() {
  await requirePermission("planograma");

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
