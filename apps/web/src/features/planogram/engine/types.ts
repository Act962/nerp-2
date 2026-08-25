// Tipos do editor de planograma. TODA medida é em MILÍMETRO INTEIRO — somar
// dezenas de larguras em float acumula deriva; em mm é exato e casa com a
// precisão de uma trena. A UI formata em cm via units.ts.

export type FixtureKind =
  | "GONDOLA"
  | "PONTA_GONDOLA"
  | "ILHA"
  | "CHECKOUT"
  | "GELADEIRA"
  | "EXPOSITOR"
  | "CLIP_STRIP";

export type ShelfKind = "PRATELEIRA" | "GANCHEIRA" | "CESTO" | "CAIXARIA";

export type ShelfLayoutMode = "PACKED" | "FREE";

export type ItemOrientation = "FRENTE" | "LADO" | "TOPO";

export type ColorBy = "BRAND" | "CATEGORY" | "SUPPLIER" | "NONE";

export interface FixtureNode {
  id: string;
  kind: FixtureKind;
  name: string;
  order: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  baseHeightMm: number;
  colorHex: string | null;
  mapObjectId: string | null;
}

export interface ModuleNode {
  id: string;
  fixtureId: string;
  index: number;
  widthMm: number;
  label: string | null;
}

export interface ShelfDivider {
  xMm: number;
}

export interface ShelfNode {
  id: string;
  moduleId: string;
  index: number;
  /** Topo da prateleira medido a partir do piso. */
  yMm: number;
  widthMm: number;
  depthMm: number;
  thicknessMm: number;
  kind: ShelfKind;
  layoutMode: ShelfLayoutMode;
  maxWeightKg: number | null;
  /** null = herda a cor padrão da longarina. */
  colorHex: string | null;
  dividers: ShelfDivider[];
}

export interface ItemNode {
  id: string;
  shelfId: string;
  productId: string;
  /** Fonte de verdade da posição no modo PACKED. */
  position: number;
  /** Só usado quando a prateleira está em FREE. */
  xMm: number | null;
  facings: number;
  facingsDeep: number;
  facingsHigh: number;
  orientation: ItemOrientation;
  isBoxed: boolean;
  /** Snapshot da medida do produto no momento em que foi posicionado. */
  widthMm: number;
  heightMm: number;
  depthMm: number;
  note: string | null;
}

/** Dados do produto necessários ao render — vêm do catálogo, não do item. */
export interface ProductRef {
  id: string;
  name: string;
  barcode: string | null;
  thumbnail: string | null;
  brandId: string | null;
  brandName: string | null;
  categoryId: string | null;
  supplierId: string | null;
  /** Medida ATUAL no cadastro — comparada com o snapshot do item. */
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  packWidthMm: number | null;
  packHeightMm: number | null;
  packDepthMm: number | null;
}

export interface PlanogramMeta {
  id: string;
  name: string;
  status: string;
  isActive: boolean;
  currentVersion: number;
  categoryId: string | null;
}

/** Payload de hidratação vindo do servidor. */
export interface PlanogramScene {
  meta: PlanogramMeta;
  fixtures: FixtureNode[];
  modules: ModuleNode[];
  shelves: ShelfNode[];
  items: ItemNode[];
  products: ProductRef[];
}

/** Gôndola salva como padrão da rede, com os níveis exatamente onde estavam. */
export interface FixtureTemplate {
  id: string;
  name: string;
  kind: FixtureKind;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  baseHeightMm: number;
  colorHex: string | null;
  moduleCount: number;
  shelves: TemplateShelf[];
  isDefault: boolean;
}

export interface TemplateShelf {
  yMm: number;
  widthMm: number;
  depthMm: number;
  thicknessMm: number;
  kind: ShelfKind;
  colorHex: string | null;
}
