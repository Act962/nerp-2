import { PlanogramVersions } from "@/features/planogram/components/planogram-versions";

export default async function RevisoesPage({
  params,
}: {
  params: Promise<{ planogramId: string }>;
}) {
  const { planogramId } = await params;
  return <PlanogramVersions planogramId={planogramId} />;
}
