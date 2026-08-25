import type {
  EditorTool,
  MapObjectStyle,
  MapObjectType,
  MapShapeKind,
} from "./types";

export interface CreateToolDef {
  type: MapObjectType;
  label: string;
  shapeKind: Extract<MapShapeKind, "RECT" | "POINT">;
  style: MapObjectStyle;
  /** Tamanho padrão em metros ao clicar (sem arrastar). */
  defaultSizeM: number;
}

/**
 * Ferramentas de criação da v1. Todas produzem retângulos (arraste para
 * dimensionar) exceto o Pin, que é um ponto. Formas livres (polígono) entram
 * numa etapa posterior.
 */
export const CREATE_TOOLS: CreateToolDef[] = [
  {
    type: "WALL",
    label: "Parede",
    shapeKind: "RECT",
    style: { fill: "#94a3b8", stroke: "#475569", strokeWidth: 1 },
    defaultSizeM: 2,
  },
  {
    type: "GONDOLA",
    label: "Gôndola",
    shapeKind: "RECT",
    style: { fill: "#bfdbfe", stroke: "#2563eb", strokeWidth: 1 },
    defaultSizeM: 2,
  },
  {
    type: "SECTOR",
    label: "Setor",
    shapeKind: "RECT",
    style: { fill: "#fef9c3", stroke: "#ca8a04", strokeWidth: 1, opacity: 0.5 },
    defaultSizeM: 4,
  },
  {
    type: "ISLAND",
    label: "Ilha",
    shapeKind: "RECT",
    style: { fill: "#fbcfe8", stroke: "#db2777", strokeWidth: 1 },
    defaultSizeM: 2,
  },
  {
    type: "CHECKOUT",
    label: "Caixa",
    shapeKind: "RECT",
    style: { fill: "#dcfce7", stroke: "#16a34a", strokeWidth: 1 },
    defaultSizeM: 1.5,
  },
  {
    type: "ENTRANCE",
    label: "Entrada",
    shapeKind: "RECT",
    style: { fill: "#bbf7d0", stroke: "#15803d", strokeWidth: 1 },
    defaultSizeM: 2,
  },
  {
    type: "EXIT",
    label: "Saída",
    shapeKind: "RECT",
    style: { fill: "#fecaca", stroke: "#b91c1c", strokeWidth: 1 },
    defaultSizeM: 2,
  },
  {
    type: "DEPOSIT",
    label: "Depósito",
    shapeKind: "RECT",
    style: { fill: "#e5e7eb", stroke: "#6b7280", strokeWidth: 1 },
    defaultSizeM: 4,
  },
  {
    type: "RESTRICTED_AREA",
    label: "Área restrita",
    shapeKind: "RECT",
    style: { fill: "#fee2e2", stroke: "#dc2626", strokeWidth: 1, opacity: 0.5 },
    defaultSizeM: 3,
  },
  {
    type: "PIN",
    label: "Pin",
    shapeKind: "POINT",
    style: { fill: "#f97316", stroke: "#c2410c", strokeWidth: 1 },
    defaultSizeM: 0.4,
  },
];

export const CREATE_TOOLS_BY_TYPE: Map<EditorTool, CreateToolDef> = new Map(
  CREATE_TOOLS.map((tool) => [tool.type, tool]),
);
