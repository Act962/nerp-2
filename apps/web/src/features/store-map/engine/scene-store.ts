"use client";

import type { MapAnnotationType } from "@/generated/prisma/enums";
import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { boundsOf, clamp, translateGeometry, unionBounds } from "./geometry";
import type {
  Bounds,
  EditorTool,
  FloorPlanMeta,
  FloorPlanScene,
  Geometry,
  MapObjectStyle,
  MapObjectType,
  ObjectId,
  SceneLayer,
  SceneObject,
  Vec2,
  Viewport,
} from "./types";

export interface ImageSize {
  width: number;
  height: number;
}

// Enquadra pelo conteúdo real (imagem de fundo + objetos), não pelo tamanho
// nominal widthM/heightM da planta — que costuma ficar no default (50x50) e
// sobra bem maior que a imagem calibrada, deixando faixas em branco na tela.
function computeContentBounds(
  floorPlan: FloorPlanMeta,
  objects: Record<ObjectId, SceneObject>,
  backgroundImageSize: ImageSize | null,
): Bounds {
  let bounds: Bounds | null = null;

  if (backgroundImageSize && floorPlan.backgroundImageKey) {
    const transform = floorPlan.backgroundTransform;
    const scale = transform?.scale ?? floorPlan.widthM / backgroundImageSize.width;
    const x = transform?.x ?? 0;
    const y = transform?.y ?? 0;
    bounds = {
      minX: x,
      minY: y,
      maxX: x + backgroundImageSize.width * scale,
      maxY: y + backgroundImageSize.height * scale,
    };
  }

  for (const object of Object.values(objects)) {
    const objectBounds = boundsOf(object.geometry);
    bounds = bounds ? unionBounds(bounds, objectBounds) : objectBounds;
  }

  // Planta nova, sem imagem nem objetos: cai no tamanho nominal.
  if (!bounds) {
    return { minX: 0, minY: 0, maxX: floorPlan.widthM, maxY: floorPlan.heightM };
  }

  // Não deixa o enquadramento colapsar num único ponto/objeto minúsculo.
  const MIN_CONTENT_SPAN_M = 2;
  const width = Math.max(bounds.maxX - bounds.minX, MIN_CONTENT_SPAN_M);
  const height = Math.max(bounds.maxY - bounds.minY, MIN_CONTENT_SPAN_M);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return {
    minX: cx - width / 2,
    minY: cy - height / 2,
    maxX: cx + width / 2,
    maxY: cy + height / 2,
  };
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const HISTORY_LIMIT = 50;
// Sobra ao redor do objeto focado (2 = o objeto ocupa metade da tela).
const FOCUS_PADDING_RATIO = 2.5;
const MIN_FOCUS_SPAN_M = 1;

interface Snapshot {
  objects: Record<ObjectId, SceneObject>;
  layers: SceneLayer[];
}

export interface AddObjectInput {
  type: MapObjectType;
  layerId: string;
  geometry: Geometry;
  style?: MapObjectStyle;
  name?: string | null;
  heightM?: number | null;
  // Sugestão de mídia por tipo de ferramenta (DEFAULT_MEDIA_TYPE_BY_OBJECT_TYPE)
  // — o admin troca livremente no painel, nunca é obrigatório.
  mediaTypeId?: string | null;
}

export interface SceneState {
  floorPlan: FloorPlanMeta | null;
  objects: Record<ObjectId, SceneObject>;
  layers: SceneLayer[];
  selectedIds: ObjectId[];
  activeLayerId: string | null;
  viewport: Viewport;
  stageSize: { width: number; height: number };
  // Tamanho natural (px) da imagem de fundo carregada — usado por fitToPlan
  // pra enquadrar pelo conteúdo real, não pelo widthM/heightM nominal.
  backgroundImageSize: ImageSize | null;
  tool: EditorTool;
  // Calibração de escala (medir uma referência real sobre a planta)
  calibrating: boolean;
  calibrationPoints: Vec2[];
  // Modo de anotação: próximo clique cria uma anotação do tipo escolhido
  annotating: boolean;
  annotationType: MapAnnotationType;
  gridEnabled: boolean;
  snapEnabled: boolean;
  gridSizeM: number;
  // Guias de alinhamento ativas durante o arraste (coords de mundo, metros)
  guides: { x: number[]; y: number[] };
  // Fila de persistência
  dirtyIds: Set<ObjectId>;
  newIds: Set<ObjectId>;
  deletedIds: Set<ObjectId>;
  // Histórico
  past: Snapshot[];
  future: Snapshot[];

  hydrate: (scene: FloorPlanScene) => void;
  patchFloorPlan: (patch: Partial<FloorPlanMeta>) => void;
  beginCalibration: () => void;
  pushCalibrationPoint: (point: Vec2) => void;
  endCalibration: () => void;
  setAnnotating: (on: boolean, type?: MapAnnotationType) => void;
  setViewport: (viewport: Viewport) => void;
  setStageSize: (size: { width: number; height: number }) => void;
  setBackgroundImageSize: (size: ImageSize | null) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAt: (screenPoint: Vec2, factor: number) => void;
  zoomByStep: (factor: number) => void;
  fitToPlan: () => void;
  focusObject: (id: ObjectId) => void;
  setTool: (tool: EditorTool) => void;
  setActiveLayer: (layerId: string) => void;
  setSelection: (ids: ObjectId[]) => void;
  toggleSelection: (id: ObjectId) => void;
  clearSelection: () => void;
  addObject: (input: AddObjectInput) => ObjectId;
  updateObject: (id: ObjectId, patch: Partial<SceneObject>) => void;
  updateObjectGeometry: (id: ObjectId, geometry: Geometry) => void;
  moveSelectedBy: (dx: number, dy: number) => void;
  removeObjects: (ids: ObjectId[]) => void;
  removeSelected: () => void;
  addLayer: (name: string) => SceneLayer;
  updateLayer: (id: string, patch: Partial<SceneLayer>) => void;
  removeLayer: (id: string) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setGuides: (guides: { x: number[]; y: number[] }) => void;
  undo: () => void;
  redo: () => void;
  consumeDirty: () => { upserts: SceneObject[]; deletes: ObjectId[] };
  hasPendingChanges: () => boolean;
}

function snapshot(state: SceneState): Snapshot {
  return { objects: state.objects, layers: state.layers };
}

function pushHistory(state: SceneState): Snapshot[] {
  const past = [...state.past, snapshot(state)];
  if (past.length > HISTORY_LIMIT) past.shift();
  return past;
}

export const useSceneStore = create<SceneState>((set, get) => ({
  floorPlan: null,
  objects: {},
  layers: [],
  selectedIds: [],
  activeLayerId: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  stageSize: { width: 0, height: 0 },
  backgroundImageSize: null,
  tool: "SELECT",
  calibrating: false,
  calibrationPoints: [],
  annotating: false,
  annotationType: "PIN",
  gridEnabled: true,
  snapEnabled: true,
  gridSizeM: 0.5,
  guides: { x: [], y: [] },
  dirtyIds: new Set(),
  newIds: new Set(),
  deletedIds: new Set(),
  past: [],
  future: [],

  hydrate: (scene) => {
    const objects: Record<ObjectId, SceneObject> = {};
    for (const object of scene.objects) objects[object.id] = object;
    const layers = [...scene.layers].sort((a, b) => a.order - b.order);
    set({
      floorPlan: scene.floorPlan,
      objects,
      layers,
      activeLayerId: layers[0]?.id ?? null,
      selectedIds: [],
      // Nova planta pode ter outra imagem (ou nenhuma); descarta o tamanho da
      // anterior até o MapBackground carregar e reportar de novo.
      backgroundImageSize: null,
      dirtyIds: new Set(),
      newIds: new Set(),
      deletedIds: new Set(),
      past: [],
      future: [],
    });
  },

  patchFloorPlan: (patch) =>
    set((state) =>
      state.floorPlan ? { floorPlan: { ...state.floorPlan, ...patch } } : {},
    ),

  beginCalibration: () =>
    set({
      calibrating: true,
      calibrationPoints: [],
      tool: "SELECT",
      annotating: false,
    }),
  pushCalibrationPoint: (point) =>
    set((state) => {
      if (!state.calibrating || state.calibrationPoints.length >= 2) return {};
      return { calibrationPoints: [...state.calibrationPoints, point] };
    }),
  endCalibration: () => set({ calibrating: false, calibrationPoints: [] }),

  setAnnotating: (on, type) =>
    set((state) => ({
      annotating: on,
      annotationType: type ?? state.annotationType,
      tool: on ? "SELECT" : state.tool,
      calibrating: on ? false : state.calibrating,
    })),

  setViewport: (viewport) => set({ viewport }),
  setStageSize: (stageSize) => set({ stageSize }),
  setBackgroundImageSize: (backgroundImageSize) => set({ backgroundImageSize }),

  panBy: (dx, dy) =>
    set((state) => ({
      viewport: {
        ...state.viewport,
        x: state.viewport.x + dx,
        y: state.viewport.y + dy,
      },
    })),

  zoomAt: (screenPoint, factor) =>
    set((state) => {
      const ppm = state.floorPlan?.pixelsPerMeter ?? 50;
      const { viewport } = state;
      const nextZoom = clamp(viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      const scale = viewport.zoom * ppm;
      const worldX = (screenPoint.x - viewport.x) / scale;
      const worldY = (screenPoint.y - viewport.y) / scale;
      const nextScale = nextZoom * ppm;
      return {
        viewport: {
          zoom: nextZoom,
          x: screenPoint.x - worldX * nextScale,
          y: screenPoint.y - worldY * nextScale,
        },
      };
    }),

  zoomByStep: (factor) => {
    const { stageSize } = get();
    get().zoomAt({ x: stageSize.width / 2, y: stageSize.height / 2 }, factor);
  },

  fitToPlan: () =>
    set((state) => {
      const { floorPlan, stageSize, objects, backgroundImageSize } = state;
      if (!floorPlan || stageSize.width === 0 || stageSize.height === 0) {
        return {};
      }
      const content = computeContentBounds(floorPlan, objects, backgroundImageSize);
      const contentWidthM = content.maxX - content.minX;
      const contentHeightM = content.maxY - content.minY;
      const padding = 40;
      const scaleX =
        (stageSize.width - padding * 2) / (contentWidthM * floorPlan.pixelsPerMeter);
      const scaleY =
        (stageSize.height - padding * 2) / (contentHeightM * floorPlan.pixelsPerMeter);
      const zoom = clamp(Math.min(scaleX, scaleY), MIN_ZOOM, MAX_ZOOM);
      const scale = zoom * floorPlan.pixelsPerMeter;
      const centerX = (content.minX + content.maxX) / 2;
      const centerY = (content.minY + content.maxY) / 2;
      return {
        viewport: {
          zoom,
          x: stageSize.width / 2 - centerX * scale,
          y: stageSize.height / 2 - centerY * scale,
        },
      };
    }),

  focusObject: (id) =>
    set((state) => {
      const object = state.objects[id];
      const { floorPlan, stageSize } = state;
      if (!object || !floorPlan || stageSize.width === 0) {
        return { selectedIds: [id] };
      }

      const bounds = boundsOf(object.geometry);
      // POINT (e retângulos degenerados) não têm área: garante um enquadramento mínimo.
      const widthM = Math.max(bounds.maxX - bounds.minX, MIN_FOCUS_SPAN_M);
      const heightM = Math.max(bounds.maxY - bounds.minY, MIN_FOCUS_SPAN_M);
      const ppm = floorPlan.pixelsPerMeter;

      const zoom = clamp(
        Math.min(
          stageSize.width / (widthM * ppm * FOCUS_PADDING_RATIO),
          stageSize.height / (heightM * ppm * FOCUS_PADDING_RATIO),
        ),
        MIN_ZOOM,
        MAX_ZOOM,
      );

      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      const scale = zoom * ppm;

      return {
        selectedIds: [id],
        viewport: {
          zoom,
          x: stageSize.width / 2 - centerX * scale,
          y: stageSize.height / 2 - centerY * scale,
        },
      };
    }),

  setTool: (tool) => set({ tool, annotating: false }),
  setActiveLayer: (activeLayerId) => set({ activeLayerId }),
  setSelection: (selectedIds) => set({ selectedIds }),
  toggleSelection: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((current) => current !== id)
        : [...state.selectedIds, id],
    })),
  clearSelection: () => set({ selectedIds: [] }),

  addObject: (input) => {
    const id = uuidv4();
    set((state) => {
      const maxZ = Object.values(state.objects).reduce(
        (max, object) => Math.max(max, object.z),
        0,
      );
      const object: SceneObject = {
        id,
        type: input.type,
        layerId: input.layerId,
        geometry: input.geometry,
        z: maxZ + 1,
        heightM: input.heightM ?? null,
        style: input.style ?? {},
        name: input.name ?? null,
        spaceState: "LIVRE",
        spaceCode: null,
        spaceSeq: null,
        status: null,
        category: null,
        responsibleName: null,
        lastVisitAt: null,
        supplierId: null,
        brandId: null,
        mediaTypeId: input.mediaTypeId ?? null,
        sectorId: null,
        tier: null,
        flowLevel: null,
        visibility: null,
        isExclusive: false,
        revenuePotential: null,
        avgSalesAmount: null,
        activeNegotiation: null,
        properties: {},
      };
      const dirtyIds = new Set(state.dirtyIds).add(id);
      const newIds = new Set(state.newIds).add(id);
      return {
        past: pushHistory(state),
        future: [],
        objects: { ...state.objects, [id]: object },
        selectedIds: [id],
        dirtyIds,
        newIds,
      };
    });
    return id;
  },

  updateObject: (id, patch) =>
    set((state) => {
      const object = state.objects[id];
      if (!object) return {};
      return {
        past: pushHistory(state),
        future: [],
        objects: { ...state.objects, [id]: { ...object, ...patch, id } },
        dirtyIds: new Set(state.dirtyIds).add(id),
      };
    }),

  updateObjectGeometry: (id, geometry) =>
    set((state) => {
      const object = state.objects[id];
      if (!object) return {};
      return {
        past: pushHistory(state),
        future: [],
        objects: { ...state.objects, [id]: { ...object, geometry } },
        dirtyIds: new Set(state.dirtyIds).add(id),
      };
    }),

  moveSelectedBy: (dx, dy) =>
    set((state) => {
      if (state.selectedIds.length === 0) return {};
      const objects = { ...state.objects };
      const dirtyIds = new Set(state.dirtyIds);
      for (const id of state.selectedIds) {
        const object = objects[id];
        if (!object) continue;
        objects[id] = {
          ...object,
          geometry: translateGeometry(object.geometry, dx, dy),
        };
        dirtyIds.add(id);
      }
      return { past: pushHistory(state), future: [], objects, dirtyIds };
    }),

  removeObjects: (ids) =>
    set((state) => {
      if (ids.length === 0) return {};
      const objects = { ...state.objects };
      const dirtyIds = new Set(state.dirtyIds);
      const newIds = new Set(state.newIds);
      const deletedIds = new Set(state.deletedIds);
      for (const id of ids) {
        delete objects[id];
        dirtyIds.delete(id);
        if (newIds.has(id)) {
          newIds.delete(id);
        } else {
          deletedIds.add(id);
        }
      }
      return {
        past: pushHistory(state),
        future: [],
        objects,
        selectedIds: state.selectedIds.filter((id) => !ids.includes(id)),
        dirtyIds,
        newIds,
        deletedIds,
      };
    }),

  removeSelected: () => get().removeObjects(get().selectedIds),

  addLayer: (name) => {
    const state = get();
    const order = state.layers.reduce(
      (max, layer) => Math.max(max, layer.order),
      -1,
    );
    const layer: SceneLayer = {
      id: uuidv4(),
      name,
      order: order + 1,
      visible: true,
      locked: false,
      color: null,
    };
    set({ layers: [...state.layers, layer], activeLayerId: layer.id });
    return layer;
  },

  updateLayer: (id, patch) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, ...patch, id } : layer,
      ),
    })),

  removeLayer: (id) =>
    set((state) => {
      if (state.layers.length <= 1) return {};
      const layers = state.layers.filter((layer) => layer.id !== id);
      const objects = { ...state.objects };
      const deletedIds = new Set(state.deletedIds);
      const newIds = new Set(state.newIds);
      const dirtyIds = new Set(state.dirtyIds);
      for (const object of Object.values(state.objects)) {
        if (object.layerId !== id) continue;
        delete objects[object.id];
        dirtyIds.delete(object.id);
        if (newIds.has(object.id)) newIds.delete(object.id);
        else deletedIds.add(object.id);
      }
      return {
        layers,
        objects,
        activeLayerId:
          state.activeLayerId === id
            ? (layers[0]?.id ?? null)
            : state.activeLayerId,
        dirtyIds,
        newIds,
        deletedIds,
      };
    }),

  toggleGrid: () => set((state) => ({ gridEnabled: !state.gridEnabled })),
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
  setGuides: (guides) => set({ guides }),

  undo: () =>
    set((state) => {
      const previous = state.past[state.past.length - 1];
      if (!previous) return {};
      return {
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future],
        objects: previous.objects,
        layers: previous.layers,
        selectedIds: [],
        dirtyIds: markAll(previous.objects),
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return {};
      return {
        past: [...state.past, snapshot(state)],
        future: state.future.slice(1),
        objects: next.objects,
        layers: next.layers,
        selectedIds: [],
        dirtyIds: markAll(next.objects),
      };
    }),

  consumeDirty: () => {
    const state = get();
    const upserts = Array.from(state.dirtyIds)
      .map((id) => state.objects[id])
      .filter((object): object is SceneObject => Boolean(object));
    const deletes = Array.from(state.deletedIds);
    set({
      dirtyIds: new Set(),
      deletedIds: new Set(),
      newIds: new Set(),
    });
    return { upserts, deletes };
  },

  hasPendingChanges: () => {
    const state = get();
    return state.dirtyIds.size > 0 || state.deletedIds.size > 0;
  },
}));

function markAll(objects: Record<ObjectId, SceneObject>): Set<ObjectId> {
  return new Set(Object.keys(objects));
}
