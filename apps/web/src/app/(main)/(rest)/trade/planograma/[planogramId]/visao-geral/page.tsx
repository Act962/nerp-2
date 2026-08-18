import { PlanogramOverview } from "@/features/planogram/components/planogram-overview";

export default async function VisaoGeralPlanogramaPage({
  params,
}: {
  params: Promise<{ planogramId: string }>;
}) {
  const { planogramId } = await params;
  return <PlanogramOverview planogramId={planogramId} />;
}
