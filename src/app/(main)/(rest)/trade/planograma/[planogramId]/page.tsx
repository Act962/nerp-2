import { redirect } from "next/navigation";

export default async function PlanogramIndexPage({
  params,
}: {
  params: Promise<{ planogramId: string }>;
}) {
  const { planogramId } = await params;
  redirect(`/trade/planograma/${planogramId}/editar`);
}
