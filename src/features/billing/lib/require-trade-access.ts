import { currentOrganization, requirePermission } from "@/lib/auth-utils";
import prisma from "@/lib/db";
import type { PagePermissionKey } from "@/lib/permissions";
import { redirect } from "next/navigation";
import {
  type TradePlanTier,
  type TradeSubscriptionStatus,
  isTradeGated,
  planAllowsModule,
  resolveEffectivePlan,
} from "./plans";

// Guard de página para módulos de trade: primeiro a permissão (segurança), depois
// o plano (o tier libera o módulo?). Sem plano suficiente → manda pra página de
// plano com o módulo bloqueado sinalizado. Módulos não-gated passam direto.
export async function requireTradeAccess(key: PagePermissionKey) {
  await requirePermission(key);
  if (!isTradeGated(key)) return;

  const org = await currentOrganization();
  if (!org) redirect("/dashboard");

  // Resiliente à tabela ainda não migrada: falha na consulta → sem assinatura
  // (cortesia, acesso liberado), para não derrubar as páginas antes do migrate.
  let subscription: {
    plan: TradePlanTier;
    status: TradeSubscriptionStatus;
  } | null = null;
  try {
    subscription = await prisma.tradeSubscription.findUnique({
      where: { organizationId: org.id },
      select: { plan: true, status: true },
    });
  } catch {
    return;
  }

  const plan = resolveEffectivePlan(subscription);
  if (!planAllowsModule(plan.tier, key)) {
    redirect(`/trade/plano?bloqueado=${key}`);
  }
}
