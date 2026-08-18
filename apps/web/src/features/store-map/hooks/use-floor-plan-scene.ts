"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useSceneStore } from "../engine/scene-store";
import type { SceneObject } from "../engine/types";

export type SaveState = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 800;

function toBulkInput(object: SceneObject) {
  return {
    id: object.id,
    type: object.type,
    layerId: object.layerId,
    geometry: object.geometry,
    z: object.z,
    heightM: object.heightM,
    style: object.style,
    name: object.name,
    spaceState: object.spaceState,
    // spaceCode/spaceSeq NÃO vão no autosave — são escritos só por assignSpaceCode
    // (bulk-upsert nem aceita), então um arraste nunca apaga o Digital Space ID.
    status: object.status,
    category: object.category,
    responsibleName: object.responsibleName,
    lastVisitAt: object.lastVisitAt,
    supplierId: object.supplierId,
    brandId: object.brandId,
    properties: object.properties,
  };
}

export function useFloorPlanScene(floorPlanId: string) {
  const hydrate = useSceneStore((state) => state.hydrate);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const { data, isPending, isError } = useQuery({
    ...orpc.floorPlan.getFull.queryOptions({ input: { id: floorPlanId } }),
    enabled: !!floorPlanId,
  });

  useEffect(() => {
    if (data) hydrate(data);
  }, [data, hydrate]);

  const bulkUpsert = useMutation(orpc.mapObject.bulkUpsert.mutationOptions({}));
  const bulkDelete = useMutation(orpc.mapObject.bulkDelete.mutationOptions({}));

  const bulkUpsertAsync = bulkUpsert.mutateAsync;
  const bulkDeleteAsync = bulkDelete.mutateAsync;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!floorPlanId) return;

    const flush = async () => {
      const { upserts, deletes } = useSceneStore.getState().consumeDirty();
      if (upserts.length === 0 && deletes.length === 0) return;
      setSaveState("saving");
      try {
        if (upserts.length > 0) {
          await bulkUpsertAsync({
            floorPlanId,
            objects: upserts.map(toBulkInput),
          });
        }
        if (deletes.length > 0) {
          await bulkDeleteAsync({ floorPlanId, ids: deletes });
        }
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    };

    const unsubscribe = useSceneStore.subscribe((state, prev) => {
      if (
        state.dirtyIds === prev.dirtyIds &&
        state.deletedIds === prev.deletedIds
      ) {
        return;
      }
      if (!useSceneStore.getState().hasPendingChanges()) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, DEBOUNCE_MS);
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      unsubscribe();
    };
  }, [floorPlanId, bulkUpsertAsync, bulkDeleteAsync]);

  return { isLoading: isPending, isError, saveState };
}
