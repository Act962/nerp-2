"use client";

import { create } from "zustand";
import type { MapSpaceState } from "./types";

export type HeatMetric =
  | "NONE"
  | "AVG_SALES"
  | "NEGOTIATED_VALUE"
  | "ACTION_VALUE";

// Store separado do useSceneStore de propósito: o viewer roda o mesmo
// autosave do editor (map-viewer.tsx monta useFloorPlanScene), então estado
// de filtro/heatmap nunca pode tocar useSceneStore — senão vira escrita real
// no banco a partir do celular do promotor. Importado só pelo viewer.
export interface MapFilterValues {
  mediaTypeIds: string[];
  negotiationTypeIds: string[];
  sectorIds: string[];
  spaceStates: MapSpaceState[];
  minAvgSales: number | null;
  topSellersOnly: boolean;
  heatMetric: HeatMetric;
}

export interface MapFilterState extends MapFilterValues {
  setMediaTypeIds: (ids: string[]) => void;
  setNegotiationTypeIds: (ids: string[]) => void;
  setSectorIds: (ids: string[]) => void;
  setSpaceStates: (states: MapSpaceState[]) => void;
  setMinAvgSales: (value: number | null) => void;
  setTopSellersOnly: (value: boolean) => void;
  setHeatMetric: (metric: HeatMetric) => void;
  reset: () => void;
}

const initialFilters = {
  mediaTypeIds: [] as string[],
  negotiationTypeIds: [] as string[],
  sectorIds: [] as string[],
  spaceStates: [] as MapSpaceState[],
  minAvgSales: null as number | null,
  topSellersOnly: false,
  heatMetric: "NONE" as HeatMetric,
};

export const useMapFilterStore = create<MapFilterState>((set) => ({
  ...initialFilters,
  setMediaTypeIds: (mediaTypeIds) => set({ mediaTypeIds }),
  setNegotiationTypeIds: (negotiationTypeIds) => set({ negotiationTypeIds }),
  setSectorIds: (sectorIds) => set({ sectorIds }),
  setSpaceStates: (spaceStates) => set({ spaceStates }),
  setMinAvgSales: (minAvgSales) => set({ minAvgSales }),
  setTopSellersOnly: (topSellersOnly) => set({ topSellersOnly }),
  setHeatMetric: (heatMetric) => set({ heatMetric }),
  reset: () => set({ ...initialFilters }),
}));

export function hasActiveFilters(
  state: Pick<
    MapFilterValues,
    | "mediaTypeIds"
    | "negotiationTypeIds"
    | "sectorIds"
    | "spaceStates"
    | "minAvgSales"
    | "topSellersOnly"
  >,
): boolean {
  return (
    state.mediaTypeIds.length > 0 ||
    state.negotiationTypeIds.length > 0 ||
    state.sectorIds.length > 0 ||
    state.spaceStates.length > 0 ||
    state.minAvgSales != null ||
    state.topSellersOnly
  );
}
