"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_PERMISSIONS } from "@/lib/permissions";
import { AlertTriangle, Check } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useBilling, useSetBillingPlan } from "../hooks/use-billing";
import {
  PLAN_ORDER,
  PLANS,
  type TradePlanTier,
  formatPlanPrice,
} from "../lib/plans";

const MODULE_LABEL = new Map<string, string>(
  PAGE_PERMISSIONS.map((page) => [page.key, page.label]),
);

const STATUS_LABEL: Record<string, string> = {
  ATIVA: "Ativa",
  CORTESIA: "Cortesia (sem cobrança)",
  INADIMPLENTE: "Pagamento em atraso",
  CANCELADA: "Cancelada",
};

function quotaText(value: number, unit?: string) {
  if (value === 0) return "não incluído";
  return `${value.toLocaleString("pt-BR")}${unit ? ` ${unit}` : ""}`;
}

function UsageRow({
  label,
  used,
  limit,
  unit,
}: {
  label: string;
  used: number;
  limit: number;
  unit?: string;
}) {
  const included = limit > 0;
  const ratio = included ? Math.min(1, used / limit) : 0;
  const over = included && used > limit;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`tabular-nums ${over ? "text-red-600" : ""}`}>
          {used.toLocaleString("pt-BR")}
          {included ? ` / ${limit.toLocaleString("pt-BR")}` : ""}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${over ? "bg-red-500" : "bg-primary"}`}
          style={{ width: included ? `${ratio * 100}%` : "0%" }}
        />
      </div>
    </div>
  );
}

export function PlanManager() {
  const { data, isLoading } = useBilling();
  const setPlan = useSetBillingPlan();
  const searchParams = useSearchParams();
  const blocked = searchParams.get("bloqueado");

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { effectivePlan, usage } = data;
  const currentTier = effectivePlan.tier;
  const currentQuotas = currentTier ? PLANS[currentTier].quotas : null;

  function choose(plan: TradePlanTier) {
    setPlan.mutate(
      { plan },
      {
        onSuccess: (result) =>
          toast.success(`Plano ${PLANS[result.plan].name} aplicado (cortesia)`),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="space-y-6">
      {blocked && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            O módulo <strong>{MODULE_LABEL.get(blocked) ?? blocked}</strong> não
            está incluído no seu plano atual. Escolha um plano que o libere
            abaixo.
          </span>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-muted-foreground text-xs">Plano atual</p>
            <p className="font-semibold text-lg">
              {currentTier ? PLANS[currentTier].name : "Sem plano ativo"}
              <span className="ml-2 font-normal text-muted-foreground text-sm">
                {STATUS_LABEL[effectivePlan.status] ?? effectivePlan.status}
              </span>
            </p>
            {!effectivePlan.hasSubscription && (
              <p className="text-muted-foreground text-xs">
                Acesso liberado por cortesia — escolha um plano para formalizar.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {currentQuotas && (
        <section className="space-y-3">
          <h2 className="font-medium text-sm">Uso do mês</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <UsageRow
              label="Usuários"
              used={usage.adminUsers}
              limit={currentQuotas.adminUsers}
            />
            <UsageRow
              label="Promotores"
              used={usage.promoters}
              limit={currentQuotas.promoters}
            />
            <UsageRow
              label="Fotos no mês"
              used={usage.photosThisMonth}
              limit={currentQuotas.photosPerMonth}
            />
            <UsageRow
              label="Armazenamento"
              used={usage.storageEstimateGb}
              limit={currentQuotas.storageGb}
              unit="GB"
            />
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Planogramas</span>
              <span className="tabular-nums">
                {usage.planograms.toLocaleString("pt-BR")}
                {currentQuotas.planogramsUnlimited ? " / ilimitado" : " / —"}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Books</span>
              <span className="tabular-nums">
                {usage.books.toLocaleString("pt-BR")}
                {currentQuotas.booksIncluded ? " / ilimitado" : " / —"}
              </span>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-medium text-sm">Planos</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {PLAN_ORDER.map((tier) => {
            const plan = PLANS[tier];
            const isCurrent = currentTier === tier;
            return (
              <Card
                key={tier}
                className={isCurrent ? "border-primary shadow-sm" : undefined}
              >
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-lg">{plan.name}</span>
                    {isCurrent && <Badge>Atual</Badge>}
                  </div>
                  <div>
                    <span className="font-bold text-2xl">
                      {formatPlanPrice(plan.priceCents)}
                    </span>
                    <span className="text-muted-foreground text-sm">/mês</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {plan.tagline}
                  </p>

                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600" />
                      {plan.modules.length} módulos de trade
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600" />
                      {plan.quotas.adminUsers} usuários
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600" />
                      {plan.quotas.storageGb} GB de armazenamento
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600" />
                      Planograma:{" "}
                      {plan.quotas.planogramsUnlimited ? "ilimitado" : "—"}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600" />
                      Promotor/fotos:{" "}
                      {plan.quotas.photosPerMonth > 0
                        ? `${quotaText(plan.quotas.promoters)} · ${plan.quotas.photosPerMonth.toLocaleString("pt-BR")} fotos/mês`
                        : "—"}
                    </li>
                  </ul>

                  <p className="text-muted-foreground text-xs">
                    Add-ons: {plan.addons.join(" · ")}
                  </p>

                  <div className="mt-auto">
                    <Button
                      type="button"
                      className="w-full"
                      variant={isCurrent ? "outline" : "default"}
                      disabled={isCurrent || setPlan.isPending}
                      onClick={() => choose(tier)}
                    >
                      {isCurrent ? "Plano atual" : `Escolher ${plan.name}`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-muted-foreground text-xs">
          A cobrança (Stripe/Asaas) ainda não está integrada — ao escolher, o
          plano é aplicado como cortesia. A transação de pagamento é o próximo
          passo.
        </p>
      </section>
    </div>
  );
}
