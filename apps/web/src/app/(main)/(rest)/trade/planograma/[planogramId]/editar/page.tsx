import { Spinner } from "@/components/ui/spinner";
import { PlanogramEditor } from "@/features/planogram/components/planogram-editor";
import { Suspense } from "react";

export default async function EditarPlanogramaPage({
  params,
}: {
  params: Promise<{ planogramId: string }>;
}) {
  const { planogramId } = await params;

  // O editor lê ?fixture= (vindo da visão geral) com useSearchParams; sem o
  // boundary a prerenderização falha.
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      }
    >
      <PlanogramEditor planogramId={planogramId} />
    </Suspense>
  );
}
