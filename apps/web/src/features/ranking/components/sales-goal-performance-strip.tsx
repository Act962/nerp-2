"use client";

import { cn } from "@/lib/utils";

// Faixa de performance da operação. Só aparece quando o vendido vem de ERP
// externo: margem e ticket dependem de custo e pedidos, que a venda nativa do
// NERP não guarda.
//
// Não é renderizado na página pública — o payload público não carrega estes
// campos de propósito (ver `public-list.ts`), porque margem é estrutura de
// custo do cliente.

export interface SalesGoalPerformance {
  marginTotal?: number | null;
  marginPercent?: number | null;
  averageTicket?: number | null;
  ordersTotal?: number;
  projectedTotal?: number | null;
  projectedPercent?: number | null;
  goalTotal: number;
  /** Preenchido quando a janela pedida começa antes do espelho do ERP. */
  coverageStart?: string | null;
  // Recorte ativo + os dois totais, para mostrar o modo não-selecionado como
  // indicador secundário (faturado × todos os pedidos).
  salesMode?: "INVOICED" | "PIPELINE";
  invoicedTotal?: number;
  pipelineTotal?: number;
  pace?: {
    elapsedDays: number;
    totalDays: number;
    isClosed: boolean;
  };
}

function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function Tile({
  label,
  value,
  hint,
  tone = "neutral",
  textOnDark,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "warn";
  textOnDark: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p
        className={cn(
          "text-[10px] uppercase tracking-wider truncate",
          textOnDark ? "text-white/50" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-bold tabular-nums truncate",
          tone === "good" && "text-emerald-400",
          tone === "warn" && "text-amber-400",
          tone === "neutral" && (textOnDark ? "text-white" : "text-foreground"),
        )}
      >
        {value}
      </p>
      {hint && (
        <p
          className={cn(
            "text-[10px] truncate",
            textOnDark ? "text-white/40" : "text-muted-foreground",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

export function SalesGoalPerformanceStrip({
  period,
  accent,
  textOnDark,
}: {
  period: SalesGoalPerformance;
  accent: string;
  textOnDark: boolean;
}) {
  const hasMargin =
    period.marginPercent !== null && period.marginPercent !== undefined;
  const hasProjection =
    period.projectedTotal !== null && period.projectedTotal !== undefined;

  if (!hasMargin && !hasProjection) return null;

  // Projeção só informa enquanto dá tempo de agir; com o período fechado o
  // número vira o próprio realizado e não diz nada.
  const showProjection = hasProjection && !period.pace?.isClosed;
  const projectedPercent = period.projectedPercent ?? null;
  const willMissGoal =
    period.goalTotal > 0 && projectedPercent !== null && projectedPercent < 100;

  const partialCoverage = period.coverageStart
    ? new Date(`${period.coverageStart}T00:00:00.000Z`).toLocaleDateString(
        "pt-BR",
        { timeZone: "UTC" },
      )
    : null;

  // Indicador secundário: o total do recorte que NÃO está selecionado. Só
  // aparece se os dois diferem (pipeline tem pedido em aberto além do faturado).
  const bothTotals =
    period.invoicedTotal !== undefined && period.pipelineTotal !== undefined
      ? { invoiced: period.invoicedTotal, pipeline: period.pipelineTotal }
      : null;
  const secondary =
    bothTotals && Math.abs(bothTotals.pipeline - bothTotals.invoiced) >= 1
      ? period.salesMode === "PIPELINE"
        ? { label: "Faturado", value: bothTotals.invoiced }
        : { label: "Todos os pedidos", value: bothTotals.pipeline }
      : null;

  return (
    <div
      className="rounded-xl border px-4 py-2.5 flex flex-col gap-1.5"
      style={{ borderColor: `${accent}33` }}
    >
      {/* O sync guarda janela móvel. Num período longo o total seria lido como
        o período inteiro sendo só o pedaço sincronizado — o aviso evita isso. */}
      {partialCoverage && (
        <p
          className={cn(
            "text-[10px]",
            textOnDark ? "text-amber-300/80" : "text-amber-600",
          )}
        >
          Parcial: dados sincronizados a partir de {partialCoverage}.
        </p>
      )}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        {hasMargin && (
          <Tile
            label="Margem"
            value={`${period.marginPercent?.toFixed(1)}%`}
            hint={
              period.marginTotal ? formatBrl(period.marginTotal) : undefined
            }
            textOnDark={textOnDark}
          />
        )}
        {period.averageTicket ? (
          <Tile
            label="Ticket médio"
            value={formatBrl(period.averageTicket)}
            hint={
              period.ordersTotal
                ? `${period.ordersTotal.toLocaleString("pt-BR")} pedidos`
                : undefined
            }
            textOnDark={textOnDark}
          />
        ) : null}
        {showProjection && (
          <Tile
            label="Projeção do mês"
            value={formatBrl(period.projectedTotal ?? 0)}
            hint={
              projectedPercent !== null && period.goalTotal > 0
                ? `${projectedPercent.toFixed(0)}% da meta no ritmo atual`
                : period.pace
                  ? `dia ${period.pace.elapsedDays} de ${period.pace.totalDays}`
                  : undefined
            }
            tone={willMissGoal ? "warn" : "good"}
            textOnDark={textOnDark}
          />
        )}
        {secondary && (
          <Tile
            label={secondary.label}
            value={formatBrl(secondary.value)}
            hint="outro recorte de venda"
            textOnDark={textOnDark}
          />
        )}
      </div>
    </div>
  );
}
