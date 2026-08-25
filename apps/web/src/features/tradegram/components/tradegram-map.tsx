"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { MapObjectSearch } from "@/features/store-map/components/map-object-search";
import { useMapFilterStore } from "@/features/store-map/engine/map-filter-store";
import { useSceneStore } from "@/features/store-map/engine/scene-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePublicScene } from "../hooks/use-public-scene";
import { TradegramInterestDialog } from "./tradegram-interest-dialog";
import { TradegramMapFilter } from "./tradegram-map-filter";
import { TradegramMapPanel } from "./tradegram-map-panel";

export interface InterestTarget {
  mapObjectId: string;
  kind: "INTERESSE" | "FILA_ESPERA";
  spaceCode: string | null;
  spaceLabel: string;
}

const MapViewerStage = dynamic(
  () =>
    import("@/features/store-map/renderers/konva/map-viewer-stage").then(
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

interface Props {
  orgSlug: string;
  storeId: string;
}

export function TradeGramMap({ orgSlug, storeId }: Props) {
  const searchParams = useSearchParams();
  const mediaCode = searchParams.get("media");
  const focusId = searchParams.get("focus");
  const { data, isPending, isError } = usePublicScene(orgSlug, storeId);
  const isMobile = useIsMobile();

  const zoomByStep = useSceneStore((state) => state.zoomByStep);
  const fitToPlan = useSceneStore((state) => state.fitToPlan);
  const selectedIds = useSceneStore((state) => state.selectedIds);
  const clearSelection = useSceneStore((state) => state.clearSelection);
  const setMediaTypeIds = useMapFilterStore((state) => state.setMediaTypeIds);
  const resetFilters = useMapFilterStore((state) => state.reset);

  // Read-only: força SELECT (sem herdar ferramenta de desenho) e limpa o filtro
  // ao sair, já que o filter-store é singleton de módulo.
  useEffect(() => {
    useSceneStore.getState().setTool("SELECT");
    return () => resetFilters();
  }, [resetFilters]);

  // Resolve ?media=<code> → mediaTypeId (o filtro do mapa trabalha por id).
  useEffect(() => {
    if (!data) return;
    if (!mediaCode) {
      resetFilters();
      return;
    }
    const match = data.mediaTypes.find((media) => media.code === mediaCode);
    setMediaTypeIds(match ? [match.id] : []);
  }, [data, mediaCode, setMediaTypeIds, resetFilters]);

  // "Onde está?": vindo do escaneamento, foca a gôndola do produto. Espera o
  // stage (dynamic import) montar antes de mandar o focusObject.
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!data || !focusId || focusedRef.current) return;
    focusedRef.current = true;
    const timer = setTimeout(
      () => useSceneStore.getState().focusObject(focusId),
      400,
    );
    return () => clearTimeout(timer);
  }, [data, focusId]);

  const mediaTypes = data?.mediaTypes ?? [];
  const sectors = data?.sectors ?? [];
  const hasSelection = selectedIds.length > 0;
  const [interestTarget, setInterestTarget] = useState<InterestTarget | null>(
    null,
  );

  // Abrir o dialog fecha o Sheet (limpa a seleção): evita dois modais Radix
  // empilhados no mobile. O alvo já carrega tudo que o dialog precisa.
  const openInterest = (target: InterestTarget) => {
    setInterestTarget(target);
    clearSelection();
  };

  const panel = (
    <TradegramMapPanel
      mediaTypes={mediaTypes}
      sectors={sectors}
      onInterest={openInterest}
    />
  );

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Link
          href={`/tradegram/${orgSlug}/${storeId}`}
          className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Loja
        </Link>

        {!isPending && !isError && (
          <>
            <MapObjectSearch />
            <TradegramMapFilter mediaTypes={mediaTypes} />
          </>
        )}

        <div className="ml-auto flex items-center gap-1">
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
        <div className="relative min-w-0 flex-1 overflow-hidden">
          {isError ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-muted-foreground">
              Mapa não disponível para esta loja.
            </div>
          ) : isPending ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <MapViewerStage />
          )}
        </div>

        {!isMobile && !isPending && !isError && (
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
              <SheetTitle>Informações do espaço</SheetTitle>
            </SheetHeader>
            {panel}
          </SheetContent>
        </Sheet>
      )}

      {interestTarget && (
        <TradegramInterestDialog
          open
          onOpenChange={(open) => {
            if (!open) setInterestTarget(null);
          }}
          orgSlug={orgSlug}
          storeId={storeId}
          mapObjectId={interestTarget.mapObjectId}
          kind={interestTarget.kind}
          spaceCode={interestTarget.spaceCode}
          spaceLabel={interestTarget.spaceLabel}
        />
      )}
    </div>
  );
}
