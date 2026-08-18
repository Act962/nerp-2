import type {
  MapSpaceState,
  SpaceFlowLevel,
  SpaceTier,
  SpaceVisibility,
} from "@/generated/prisma/enums";
import type { MapObjectStyle, MapObjectType, SceneObject } from "./types";

export type { MapSpaceState };

// Fallback pra objetos ainda sem mídia classificada (dado legado ou tipo sem
// sugestão óbvia). Só espaços comerciais recebem cor de estado por padrão —
// parede/entrada/depósito são cenário e mantêm a cor do tipo.
export const NEGOTIABLE_TYPES: ReadonlySet<MapObjectType> = new Set<MapObjectType>([
  "GONDOLA",
  "ISLAND",
  "CHECKOUT",
  "PIN",
]);

// Sugestão de mídia ao desenhar cada tipo — a ferramenta só SUGERE, o admin
// troca livremente no painel. Chave = código do MediaType (catálogo Fase 1).
export const DEFAULT_MEDIA_TYPE_BY_OBJECT_TYPE: Partial<Record<MapObjectType, string>> = {
  GONDOLA: "GO",
  ISLAND: "IL",
  CHECKOUT: "CK",
  PIN: "PG",
  WALL: "AD", // Adesivação de Parede
  AISLE: "AP", // Adesivação de Piso
};

// Negociabilidade é propriedade da MÍDIA, não da ferramenta de desenho — uma
// parede com "Adesivação de Parede" atribuída é negociável; sem mídia, cai no
// fallback por tipo (dado legado, antes do catálogo existir).
export function isNegotiable(object: SceneObject): boolean {
  return object.mediaTypeId !== null || NEGOTIABLE_TYPES.has(object.type);
}

export interface SpaceStateMeta {
  label: string;
  fill: string;
  stroke: string;
  dot: string;
}

export const SPACE_STATE_META: Record<MapSpaceState, SpaceStateMeta> = {
  LIVRE: { label: "Livre", fill: "#fef08a", stroke: "#ca8a04", dot: "🟡" },
  EXECUTADO: { label: "Executado", fill: "#bbf7d0", stroke: "#16a34a", dot: "🟢" },
  PENDENTE: { label: "Pendente", fill: "#fecaca", stroke: "#dc2626", dot: "🔴" },
};

export const SPACE_STATE_ORDER: MapSpaceState[] = [
  "LIVRE",
  "EXECUTADO",
  "PENDENTE",
];

export const SPACE_TIER_LABELS: Record<SpaceTier, string> = {
  PREMIUM: "Premium",
  OURO: "Ouro",
  PRATA: "Prata",
  BRONZE: "Bronze",
};
export const SPACE_TIER_ORDER: SpaceTier[] = ["PREMIUM", "OURO", "PRATA", "BRONZE"];

export const SPACE_FLOW_LABELS: Record<SpaceFlowLevel, string> = {
  MUITO_ALTO: "Muito alto",
  ALTO: "Alto",
  MEDIO: "Médio",
  BAIXO: "Baixo",
};
export const SPACE_FLOW_ORDER: SpaceFlowLevel[] = ["MUITO_ALTO", "ALTO", "MEDIO", "BAIXO"];

export const SPACE_VISIBILITY_LABELS: Record<SpaceVisibility, string> = {
  EXCELENTE: "Excelente",
  BOA: "Boa",
  REGULAR: "Regular",
};
export const SPACE_VISIBILITY_ORDER: SpaceVisibility[] = ["EXCELENTE", "BOA", "REGULAR"];

// Fonte única da verdade da cor do elemento. Editor e viewer chamam isto no
// render (shape-node.tsx), então as duas telas concordam por construção. A cor
// é derivada, nunca gravada em `style` — o bulk-upsert continua inofensivo.
export function resolveObjectStyle(object: SceneObject): MapObjectStyle {
  if (!isNegotiable(object)) return object.style;
  const meta = SPACE_STATE_META[object.spaceState];
  return { ...object.style, fill: meta.fill, stroke: meta.stroke };
}
