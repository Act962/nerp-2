import type { PagePermissionKey } from "@/lib/permissions";

// Fonte de verdade dos planos de Trade Marketing (Bronze/Prata/Ouro): preço,
// módulos liberados e cotas. Separado do `plan` PlanType do ERP.

export type TradePlanTier = "BRONZE" | "PRATA" | "OURO";

export interface PlanQuotas {
  adminUsers: number;
  promoters: number; // 0 = não incluído
  photosPerMonth: number; // 0 = não incluído
  storageGb: number;
  planogramsUnlimited: boolean;
  booksIncluded: boolean;
}

export interface PlanDef {
  tier: TradePlanTier;
  name: string;
  priceCents: number;
  tagline: string;
  modules: PagePermissionKey[];
  quotas: PlanQuotas;
  addons: string[];
}

const TIER_RANK: Record<TradePlanTier, number> = {
  BRONZE: 1,
  PRATA: 2,
  OURO: 3,
};

// Plano mínimo que libera cada módulo de trade. Chave ausente aqui = módulo não
// gated por plano (ERP core: sempre liberado).
export const MODULE_MIN_PLAN: Partial<
  Record<PagePermissionKey, TradePlanTier>
> = {
  tradegram: "BRONZE",
  // Atalho para o app público do TradeGram — mesmo plano do módulo que o serve.
  "qr-preco": "BRONZE",
  lojas: "BRONZE",
  "trade-cadastros": "BRONZE",
  "catalogo-pdv": "BRONZE",
  "trade-painel": "BRONZE",
  "trade-calendario": "BRONZE",
  // O trajeto deriva das fotos do promotor, que já é OURO.
  "mapa-de-campo": "OURO",
  "trade-interesses": "BRONZE",
  diretorio: "BRONZE",
  planograma: "PRATA",
  books: "OURO",
  promotor: "OURO",
  // Mesma família do promotor (motor de captura/rota/fotos + aba "Estou aqui")
  // — mesmo tier de plano.
  vendedor: "OURO",
  "promotor-vinculos": "OURO",
  distribuidores: "OURO",
};

export const TRADE_GATED_KEYS = Object.keys(
  MODULE_MIN_PLAN,
) as PagePermissionKey[];

export function isTradeGated(key: PagePermissionKey): boolean {
  return key in MODULE_MIN_PLAN;
}

function modulesUpTo(tier: TradePlanTier): PagePermissionKey[] {
  return TRADE_GATED_KEYS.filter((key) => {
    const min = MODULE_MIN_PLAN[key];
    return min ? TIER_RANK[tier] >= TIER_RANK[min] : false;
  });
}

export const PLANS: Record<TradePlanTier, PlanDef> = {
  BRONZE: {
    tier: "BRONZE",
    name: "Bronze",
    priceCents: 14990,
    tagline: "Comece a operar o trade: vitrine, mapas e cadastros.",
    modules: modulesUpTo("BRONZE"),
    quotas: {
      adminUsers: 5,
      promoters: 0,
      photosPerMonth: 0,
      storageGb: 2,
      planogramsUnlimited: false,
      booksIncluded: false,
    },
    addons: ["+10 usuários", "+10 GB"],
  },
  PRATA: {
    tier: "PRATA",
    name: "Prata",
    priceCents: 18990,
    tagline: "Adiciona planograma e mais capacidade de time.",
    modules: modulesUpTo("PRATA"),
    quotas: {
      adminUsers: 10,
      promoters: 0,
      photosPerMonth: 0,
      storageGb: 5,
      planogramsUnlimited: true,
      booksIncluded: false,
    },
    addons: ["+10 usuários", "+10 GB"],
  },
  OURO: {
    tier: "OURO",
    name: "Ouro",
    priceCents: 24990,
    tagline: "Operação completa: promotor em campo, fotos e books.",
    modules: modulesUpTo("OURO"),
    quotas: {
      adminUsers: 20,
      promoters: 25,
      photosPerMonth: 5000,
      storageGb: 20,
      planogramsUnlimited: true,
      booksIncluded: true,
    },
    addons: ["+5.000 fotos", "+10 promotores", "+10 GB"],
  },
};

export const PLAN_ORDER: TradePlanTier[] = ["BRONZE", "PRATA", "OURO"];

export function planAllowsModule(
  tier: TradePlanTier | null,
  key: PagePermissionKey,
): boolean {
  const min = MODULE_MIN_PLAN[key];
  if (!min) return true; // módulo não gated
  if (!tier) return false; // sem plano ativo → nenhum módulo pago
  return TIER_RANK[tier] >= TIER_RANK[min];
}

export function formatPlanPrice(priceCents: number): string {
  return (priceCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export type TradeSubscriptionStatus =
  | "ATIVA"
  | "CORTESIA"
  | "INADIMPLENTE"
  | "CANCELADA";

export interface EffectivePlan {
  tier: TradePlanTier | null;
  status: TradeSubscriptionStatus;
  hasSubscription: boolean;
}

// Plano efetivo a partir da assinatura. Sem assinatura → cortesia OURO (não
// quebra orgs existentes). CANCELADA → sem tier (módulos pagos bloqueados).
export function resolveEffectivePlan(
  subscription: { plan: TradePlanTier; status: TradeSubscriptionStatus } | null,
): EffectivePlan {
  if (!subscription) {
    return { tier: "OURO", status: "CORTESIA", hasSubscription: false };
  }
  if (subscription.status === "CANCELADA") {
    return { tier: null, status: "CANCELADA", hasSubscription: true };
  }
  return {
    tier: subscription.plan,
    status: subscription.status,
    hasSubscription: true,
  };
}
