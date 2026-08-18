import type { FixtureKind, ShelfNode } from "./types";

// Paleta declarativa de mobiliário, no mesmo espírito de store-map/engine/tools.ts:
// adicionar um tipo de gôndola = adicionar um item neste array.
// Medidas de mercado (Brasil): módulo 1000/1250/1300mm, altura 1400–2000mm,
// profundidade 400mm em parede e 600mm em base/ilha, 3 a 7 prateleiras.

export interface FixturePreset {
  id: string;
  label: string;
  kind: FixtureKind;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  baseHeightMm: number;
  shelfCount: number;
  /** Base mais funda que as demais — o padrão real de gôndola. */
  baseDepthMm?: number;
}

export const FIXTURE_PRESETS: FixturePreset[] = [
  {
    id: "gondola-1300x1900",
    label: "Gôndola 1,30 × 1,90 m",
    kind: "GONDOLA",
    widthMm: 1300,
    heightMm: 1900,
    depthMm: 400,
    baseHeightMm: 100,
    shelfCount: 5,
    baseDepthMm: 600,
  },
  {
    id: "gondola-1000x1800",
    label: "Gôndola 1,00 × 1,80 m",
    kind: "GONDOLA",
    widthMm: 1000,
    heightMm: 1800,
    depthMm: 400,
    baseHeightMm: 100,
    shelfCount: 5,
    baseDepthMm: 500,
  },
  {
    id: "ponta-1000x1800",
    label: "Ponta de gôndola 1,00 × 1,80 m",
    kind: "PONTA_GONDOLA",
    widthMm: 1000,
    heightMm: 1800,
    depthMm: 450,
    baseHeightMm: 100,
    shelfCount: 4,
  },
  {
    id: "ilha-2000x900",
    label: "Ilha 2,00 × 0,90 m",
    kind: "ILHA",
    widthMm: 2000,
    heightMm: 900,
    depthMm: 600,
    baseHeightMm: 150,
    shelfCount: 1,
  },
  {
    id: "checkout-800x1200",
    label: "Checkout 0,80 × 1,20 m",
    kind: "CHECKOUT",
    widthMm: 800,
    heightMm: 1200,
    depthMm: 250,
    baseHeightMm: 80,
    shelfCount: 4,
  },
  {
    id: "geladeira-1250x2000",
    label: "Geladeira 1,25 × 2,00 m",
    kind: "GELADEIRA",
    widthMm: 1250,
    heightMm: 2000,
    depthMm: 600,
    baseHeightMm: 200,
    shelfCount: 5,
  },
];

export const FIXTURE_PRESETS_BY_ID = new Map(
  FIXTURE_PRESETS.map((preset) => [preset.id, preset]),
);

export const FIXTURE_KIND_LABELS: Record<FixtureKind, string> = {
  GONDOLA: "Gôndola",
  PONTA_GONDOLA: "Ponta de gôndola",
  ILHA: "Ilha",
  CHECKOUT: "Checkout",
  GELADEIRA: "Geladeira",
  EXPOSITOR: "Expositor",
  CLIP_STRIP: "Clip strip",
};

const SHELF_THICKNESS_MM = 25;

/** Folga mínima entre a última prateleira e o teto da estrutura. */
export const TOP_CLEARANCE_MM = 140;

/**
 * Distribui as prateleiras entre o rodapé e o topo.
 *
 * A base fica ~1,5× mais alta que as demais porque produto grande e pesado vai
 * embaixo — é a regra prática de qualquer gôndola de supermercado, e distribuir
 * igualmente produziria uma base onde nada de garrafa cabe.
 */
export function buildShelvesForFixture(
  preset: Pick<
    FixturePreset,
    "heightMm" | "baseHeightMm" | "widthMm" | "depthMm" | "shelfCount"
  > & { baseDepthMm?: number },
  moduleId: string,
): Omit<ShelfNode, "id">[] {
  const count = Math.max(1, preset.shelfCount);
  // Reserva a folga de topo: sem ela a última prateleira nasce rente ao teto e
  // a cantoneira da longarina transborda acima do montante.
  const usableMm = Math.max(
    0,
    preset.heightMm - preset.baseHeightMm - TOP_CLEARANCE_MM,
  );

  // A base pesa 1,5 e as demais 1 — resolve o espaçamento em uma conta só.
  const weightUnits = count === 1 ? 1 : 1.5 + (count - 1);
  const unitMm = usableMm / weightUnits;
  const baseGapMm = count === 1 ? usableMm : unitMm * 1.5;

  const shelves: Omit<ShelfNode, "id">[] = [];
  let cursorMm = preset.baseHeightMm;

  for (let index = 0; index < count; index++) {
    cursorMm += index === 0 ? baseGapMm : unitMm;
    shelves.push({
      moduleId,
      index,
      yMm: Math.round(cursorMm),
      widthMm: preset.widthMm,
      depthMm:
        index === 0 ? (preset.baseDepthMm ?? preset.depthMm) : preset.depthMm,
      thicknessMm: SHELF_THICKNESS_MM,
      kind: "PRATELEIRA",
      layoutMode: "PACKED",
      maxWeightKg: null,
      colorHex: null,
      dividers: [],
    });
  }

  return shelves;
}
