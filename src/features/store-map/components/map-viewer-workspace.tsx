"use client";

import { Spinner } from "@/components/ui/spinner";
import { useStore } from "@/features/stores/hooks/use-stores";
import { Map as MapIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useFloorPlans } from "../hooks/use-floor-plans";
import { MapViewer } from "./map-viewer";

interface MapViewerWorkspaceProps {
  storeId: string;
}

export function MapViewerWorkspace({ storeId }: MapViewerWorkspaceProps) {
  const { store } = useStore(storeId);
  const { floorPlans, isLoading } = useFloorPlans(storeId);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (floorPlans.length === 0) {
      setSelectedId("");
      return;
    }
    const stillExists = floorPlans.some((plan) => plan.id === selectedId);
    if (!stillExists) setSelectedId(floorPlans[0].id);
  }, [floorPlans, selectedId]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!selectedId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <MapIcon className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Esta loja ainda não tem um mapa configurado.
        </p>
      </div>
    );
  }

  return (
    <MapViewer
      key={selectedId}
      floorPlanId={selectedId}
      storeId={storeId}
      storeName={store?.name}
      floorPlans={floorPlans}
      selectedFloorPlanId={selectedId}
      onSelectFloorPlan={setSelectedId}
    />
  );
}
