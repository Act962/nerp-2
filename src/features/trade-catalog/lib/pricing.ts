import type {
  SpaceFlowLevel,
  SpaceTier,
  SpaceVisibility,
} from "@/generated/prisma/enums";
import { areaOf } from "@/features/store-map/engine/geometry";
import type { Geometry } from "@/features/store-map/engine/types";

export interface PricingSettingsInput {
  markup: number;
  floorPrice: number | null;
  tierMultipliers: Record<SpaceTier, number>;
  flowMultipliers: Record<SpaceFlowLevel, number>;
  visibilityMultipliers: Record<SpaceVisibility, number>;
}

export interface StoreCostInput {
  areaM2: number | null;
  monthlyCost: number | null;
}

export interface MediaPricingInput {
  pricingBasis: "AREA" | "FLAT";
  notionalAreaM2: number | null;
}

export interface SpaceClassificationInput {
  tier: SpaceTier | null;
  flowLevel: SpaceFlowLevel | null;
  visibility: SpaceVisibility | null;
}

// Custo/mês do m² da loja × área efetiva × multiplicadores de classificação ×
// markup. Em R$/mês (monthlyCost já é mensal — prorratear na cotação, não
// aqui). FLAT usa notionalAreaM2 (ou 1) pra mídia sem área real (wobbler, QR)
// nunca cotar R$ 0. Sem areaM2/monthlyCost da loja, não há como sugerir preço.
export function computeSuggestedPrice(
  store: StoreCostInput,
  media: MediaPricingInput,
  space: SpaceClassificationInput,
  geometry: Geometry | null,
  settings: PricingSettingsInput,
): number | null {
  if (!store.areaM2 || !store.monthlyCost) return null;

  const costPerM2 = store.monthlyCost / store.areaM2;
  // Com geometria real de um espaço AREA-priced, usa a área desenhada (mais
  // precisa). Sem geometria (catálogo genérico, sem objeto específico) ou
  // mídia FLAT, cai pra notionalAreaM2 — senão o catálogo geral não teria
  // como sugerir preço pra nenhuma mídia AREA.
  const effectiveArea =
    geometry && media.pricingBasis === "AREA"
      ? areaOf(geometry)
      : (media.notionalAreaM2 ?? 1);
  if (effectiveArea <= 0) return null;

  const tierMultiplier = space.tier ? settings.tierMultipliers[space.tier] : 1;
  const flowMultiplier = space.flowLevel
    ? settings.flowMultipliers[space.flowLevel]
    : 1;
  const visibilityMultiplier = space.visibility
    ? settings.visibilityMultipliers[space.visibility]
    : 1;

  const raw =
    costPerM2 *
    effectiveArea *
    tierMultiplier *
    flowMultiplier *
    visibilityMultiplier *
    settings.markup;

  return Math.max(settings.floorPrice ?? 0, raw);
}

export interface ResolvedPrice {
  value: number | null;
  source: "MANUAL" | "BASE" | "SUGGESTED" | "NONE";
}

// Ordem de resolução: preço manual da loja > preço padrão da org > sugestão
// calculada > sem dado suficiente.
export function resolveDisplayPrice(
  manualPrice: number | null,
  basePrice: number | null,
  suggestedPrice: number | null,
): ResolvedPrice {
  if (manualPrice != null) return { value: manualPrice, source: "MANUAL" };
  if (basePrice != null) return { value: basePrice, source: "BASE" };
  if (suggestedPrice != null)
    return { value: suggestedPrice, source: "SUGGESTED" };
  return { value: null, source: "NONE" };
}

export const DEFAULT_TIER_MULTIPLIERS: Record<SpaceTier, number> = {
  PREMIUM: 1.5,
  OURO: 1.2,
  PRATA: 1,
  BRONZE: 0.8,
};

export const DEFAULT_FLOW_MULTIPLIERS: Record<SpaceFlowLevel, number> = {
  MUITO_ALTO: 1.4,
  ALTO: 1.15,
  MEDIO: 1,
  BAIXO: 0.85,
};

export const DEFAULT_VISIBILITY_MULTIPLIERS: Record<SpaceVisibility, number> = {
  EXCELENTE: 1.2,
  BOA: 1,
  REGULAR: 0.85,
};

export const DEFAULT_PRICING_SETTINGS: PricingSettingsInput = {
  markup: 3,
  floorPrice: null,
  tierMultipliers: DEFAULT_TIER_MULTIPLIERS,
  flowMultipliers: DEFAULT_FLOW_MULTIPLIERS,
  visibilityMultipliers: DEFAULT_VISIBILITY_MULTIPLIERS,
};
