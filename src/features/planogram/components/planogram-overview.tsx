"use client";

import { Spinner } from "@/components/ui/spinner";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { PlanogramStoreProvider } from "../engine/planogram-store-context";
import { usePlanogramFull } from "../hooks/use-planograms";

const OverviewStage = dynamic(
  () =>
    import("../renderers/konva/overview-stage").then(
      (mod) => mod.OverviewStage,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-lg border">
        <Spinner />
      </div>
    ),
  },
);

export function PlanogramOverview({ planogramId }: { planogramId: string }) {
  const { scene, isLoading } = usePlanogramFull(planogramId);
  const router = useRouter();

  if (isLoading || !scene) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <PlanogramStoreProvider key={planogramId} scene={scene}>
      <div className="flex h-[calc(100vh-13rem)] flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Todas as gôndolas do planograma lado a lado. Clique em uma para
          abri-la no editor.
        </p>
        <div className="min-h-0 flex-1">
          <OverviewStage
            onSelectFixture={(fixtureId) =>
              router.push(
                `/trade/planograma/${planogramId}/editar?fixture=${fixtureId}`,
              )
            }
          />
        </div>
      </div>
    </PlanogramStoreProvider>
  );
}
