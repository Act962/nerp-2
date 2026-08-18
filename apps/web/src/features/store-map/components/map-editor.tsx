"use client";

import { Spinner } from "@/components/ui/spinner";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useSceneStore } from "../engine/scene-store";
import { useFloorPlanScene } from "../hooks/use-floor-plan-scene";
import { BackgroundControls } from "./background-controls";
import { EditorToolbar } from "./editor-toolbar";
import { LayersPanel } from "./layers-panel";
import { ObjectPropertiesPanel } from "./object-properties-panel";
import { ScaleCalibrationDialog } from "./scale-calibration-dialog";

const MapStage = dynamic(
  () => import("../renderers/konva/map-stage").then((mod) => mod.MapStage),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    ),
  },
);

interface MapEditorProps {
  floorPlanId: string;
}

export function MapEditor({ floorPlanId }: MapEditorProps) {
  const { isLoading, isError, saveState } = useFloorPlanScene(floorPlanId);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const store = useSceneStore.getState();
      const isMod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (event.key === "Delete" || event.key === "Backspace") {
        store.removeSelected();
        event.preventDefault();
      } else if (isMod && key === "z") {
        if (event.shiftKey) store.redo();
        else store.undo();
        event.preventDefault();
      } else if (isMod && key === "y") {
        store.redo();
        event.preventDefault();
      } else if (key === "v") {
        store.setTool("SELECT");
      } else if (event.key === "Escape") {
        store.setTool("SELECT");
        store.clearSelection();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-background">
      <EditorToolbar saveState={saveState} />
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          {isError ? (
            <div className="flex h-full items-center justify-center text-sm text-destructive">
              Não foi possível carregar o mapa.
            </div>
          ) : isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              <MapStage />
              <div className="absolute left-7 top-7 z-20">
                <BackgroundControls floorPlanId={floorPlanId} />
              </div>
            </>
          )}
        </div>
        <aside className="flex w-72 shrink-0 flex-col border-l">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ObjectPropertiesPanel />
          </div>
          <div className="h-64 shrink-0 border-t">
            <LayersPanel floorPlanId={floorPlanId} />
          </div>
        </aside>
      </div>
      <ScaleCalibrationDialog floorPlanId={floorPlanId} />
    </div>
  );
}
