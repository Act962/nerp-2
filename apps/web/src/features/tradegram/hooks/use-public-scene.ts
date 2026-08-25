"use client";

import { useSceneStore } from "@/features/store-map/engine/scene-store";
import { useEffect } from "react";
import { usePublicStoreMap } from "./use-tradegram";

// Leitura pública do mapa: hidrata o scene-store com a cena sanitizada e NÃO
// instala o autosave de escrita do useFloorPlanScene — o mapa público é
// somente-leitura.
export function usePublicScene(
  orgSlug: string,
  storeId: string,
  floorPlanId?: string,
) {
  const query = usePublicStoreMap(orgSlug, storeId, floorPlanId);
  const hydrate = useSceneStore((state) => state.hydrate);

  useEffect(() => {
    if (query.data) hydrate(query.data.scene);
  }, [query.data, hydrate]);

  return query;
}
