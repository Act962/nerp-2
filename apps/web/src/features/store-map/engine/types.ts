import type {
  MapObjectType,
  MapShapeKind,
  MapSpaceState,
  SpaceFlowLevel,
  SpaceTier,
  SpaceVisibility,
} from "@/generated/prisma/enums";

export type {
  MapObjectType,
  MapShapeKind,
  MapSpaceState,
  SpaceFlowLevel,
  SpaceTier,
  SpaceVisibility,
};

export type ObjectId = string;

/** Ponto no espaço do mundo, sempre em metros (independe do motor de render). */
export interface Vec2 {
  x: number;
  y: number;
}

export interface RectGeometry {
  kind: "RECT";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface PolygonGeometry {
  kind: "POLYGON";
  points: Vec2[];
}

export interface PolylineGeometry {
  kind: "POLYLINE";
  points: Vec2[];
}

export interface PointGeometry {
  kind: "POINT";
  x: number;
  y: number;
}

export type Geometry =
  | RectGeometry
  | PolygonGeometry
  | PolylineGeometry
  | PointGeometry;

export interface MapObjectStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fontSize?: number; // tamanho do rótulo em metros (escala junto com o mapa)
}

/** Objeto do mapa no modelo de cena — a fonte da verdade durante a edição. */
export interface SceneObject {
  id: ObjectId;
  type: MapObjectType;
  layerId: string;
  geometry: Geometry;
  z: number;
  heightM: number | null;
  style: MapObjectStyle;
  name: string | null;
  spaceState: MapSpaceState;
  spaceCode: string | null;
  spaceSeq: number | null;
  status: string | null;
  category: string | null;
  responsibleName: string | null;
  lastVisitAt: string | null;
  supplierId: string | null;
  brandId: string | null;
  // Biblioteca Nacional de Espaços Comerciais
  mediaTypeId: string | null;
  sectorId: string | null;
  tier: SpaceTier | null;
  flowLevel: SpaceFlowLevel | null;
  visibility: SpaceVisibility | null;
  isExclusive: boolean;
  revenuePotential: number | null;
  avgSalesAmount: number | null;
  // Negociação FECHADA vigente hoje, resolvida no servidor (get-full.ts).
  // Alimenta o filtro por tipo de negociação e o heatmap NEGOTIATED_VALUE —
  // nunca escrito pelo client, só lido.
  activeNegotiation: ActiveNegotiation | null;
  properties: Record<string, unknown>;
}

export interface ActiveNegotiation {
  id: string;
  negotiationTypeId: string | null;
  amount: number | null;
  endDate: string | null;
}

export interface SceneLayer {
  id: string;
  name: string;
  order: number;
  visible: boolean;
  locked: boolean;
  color: string | null;
}

export interface BackgroundTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface FloorPlanMeta {
  id: string;
  storeId: string;
  name: string;
  widthM: number;
  heightM: number;
  pixelsPerMeter: number;
  backgroundImageKey: string | null;
  backgroundOpacity: number;
  backgroundTransform: BackgroundTransform | null;
}

/** Câmera 2D: deslocamento em pixels de tela + fator de zoom. */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** Caixa delimitadora em metros. */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Ferramenta ativa: navegação (SELECT/PAN) ou criação de um tipo de objeto. */
export type EditorTool = "SELECT" | "PAN" | MapObjectType;

/** Payload completo carregado do servidor para hidratar o editor. */
export interface FloorPlanScene {
  floorPlan: FloorPlanMeta;
  layers: SceneLayer[];
  objects: SceneObject[];
}
