"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { Camera, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect } from "react";
import { useSceneStore } from "../engine/scene-store";
import { useFloorPlanScene } from "../hooks/use-floor-plan-scene";
import { MapFilterPanel } from "./map-filter-panel";
import { MapObjectSearch } from "./map-object-search";
import { MapViewerPanel } from "./map-viewer-panel";

const MapViewerStage = dynamic(
  () =>
    import("../renderers/konva/map-viewer-stage").then(
      (mod) => mod.MapViewerStage,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    ),
  },
);

interface FloorPlanOption {
  id: string;
  name: string;
}

interface MapViewerProps {
  floorPlanId: string;
  storeId?: string;
  storeName?: string;
  floorPlans?: FloorPlanOption[];
  selectedFloorPlanId?: string;
  onSelectFloorPlan?: (id: string) => void;
}

export function MapViewer({
  floorPlanId,
  storeId,
  storeName,
  floorPlans = [],
  selectedFloorPlanId,
  onSelectFloorPlan,
}: MapViewerProps) {
  const { isLoading, isError } = useFloorPlanScene(floorPlanId);
  const isMobile = useIsMobile();

  const selectedIds = useSceneStore((state) => state.selectedIds);
  const clearSelection = useSceneStore((state) => state.clearSelection);
  const zoomByStep = useSceneStore((state) => state.zoomByStep);
  const fitToPlan = useSceneStore((state) => state.fitToPlan);

  const hasSelection = selectedIds.length === 1;

  // O editor pode ter deixado uma ferramenta de desenho ativa no store compartilhado.
  useEffect(() => {
    useSceneStore.getState().setTool("SELECT");
  }, []);

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        Não foi possível carregar o mapa.
      </div>
    );
  }

  const panel = <MapViewerPanel storeName={storeName} />;

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        {storeName && (
          <span className="mr-1 font-semibold tracking-tight">{storeName}</span>
        )}

        {floorPlans.length > 1 && onSelectFloorPlan && (
          <Select value={selectedFloorPlanId} onValueChange={onSelectFloorPlan}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Mapa" />
            </SelectTrigger>
            <SelectContent>
              {floorPlans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <MapObjectSearch />
        <MapFilterPanel />

        <div className="ml-auto flex items-center gap-1">
          {storeId && (
            <Button asChild size="sm" className="mr-1 gap-1.5">
              <Link href={`/promotor?storeId=${storeId}`}>
                <Camera className="size-4" /> Registrar foto
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            title="Diminuir zoom"
            onClick={() => zoomByStep(1 / 1.2)}
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            title="Aumentar zoom"
            onClick={() => zoomByStep(1.2)}
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            title="Enquadrar mapa"
            onClick={fitToPlan}
          >
            <Maximize className="size-4" />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1">
        {/* min-w-0 + overflow-hidden: sem isso o flex item não encolhe abaixo da
            largura do canvas, o mapa transborda a tela e o ResizeObserver nunca
            dispara — o promotor teria que arrastar até achar o mapa. */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <MapViewerStage />
          )}
        </div>

        {!isMobile && (
          <aside className="w-80 shrink-0 overflow-y-auto border-l">
            {panel}
          </aside>
        )}
      </div>

      {isMobile && (
        <Sheet
          open={hasSelection}
          onOpenChange={(open) => {
            if (!open) clearSelection();
          }}
        >
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader className="sr-only">
              <SheetTitle>Informações da Prateleira</SheetTitle>
            </SheetHeader>
            {panel}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
