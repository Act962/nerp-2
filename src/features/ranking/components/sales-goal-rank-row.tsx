"use client";

import { Link2 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { constructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import { useUpsertSalesGoalEntry } from "../hooks/use-ranking";
import {
  formatBrlAmountInput,
  formatBrlCompact,
  parseBrlAmount,
} from "../lib/parse-brl-amount";
import {
  formatBrl,
  MEDALS,
  type SalesGoalRankEntry,
} from "./sales-goal-podium";
import { SalesGoalAvatar } from "./sales-goal-avatar";

function InlineAmountInput({
  value,
  onCommit,
  label,
  className,
}: {
  value: number;
  onCommit: (nextValue: number) => void;
  label: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      defaultValue={formatBrlAmountInput(value)}
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
      onBlur={(event) => {
        const nextValue = parseBrlAmount(event.target.value);
        if (nextValue !== null && nextValue !== value) {
          onCommit(nextValue);
        }
        event.target.value = formatBrlAmountInput(nextValue ?? value);
      }}
      className={cn(
        "w-16 shrink-0 rounded border border-transparent bg-transparent px-0.5 text-right tabular-nums hover:border-white/20 focus:border-white/40 focus:outline-none",
        className,
      )}
    />
  );
}

function AmountLine({
  label,
  value,
  editable,
  onCommit,
  fieldLabel,
  className,
}: {
  label: string;
  value: number | null;
  editable: boolean;
  onCommit?: (nextValue: number) => void;
  fieldLabel: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 min-w-0", className)}>
      <span className="shrink-0">{label}</span>
      {editable && onCommit ? (
        <InlineAmountInput
          value={value ?? 0}
          label={fieldLabel}
          onCommit={onCommit}
          className="w-14"
        />
      ) : (
        <span className="tabular-nums truncate">
          {value !== null ? formatBrlCompact(value) : "—"}
        </span>
      )}
    </div>
  );
}

// Margem e positivação ficam no tooltip, não fixas na linha: a linha já carrega
// nove informações, e o Modo TV é fullscreen do board autenticado — margem
// individual fixa viraria comparação pessoa a pessoa no telão do escritório.
// Quem quer o detalhe alcança em um gesto; o painel continua de bater o olho.
function SellerMetricsTooltip({
  entry,
  children,
}: {
  entry: SalesGoalRankEntry;
  children: ReactNode;
}) {
  const metrics = entry.metrics;
  // Sem ERP externo (ou na tela pública) não há o que detalhar.
  if (!metrics) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">
        <p className="font-medium">{entry.sellerName}</p>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          {metrics.marginPercent !== null && (
            <>
              <dt className="opacity-70">Margem</dt>
              <dd className="tabular-nums">
                {metrics.marginPercent.toFixed(1)}% ({formatBrl(metrics.margin)}
                )
              </dd>
            </>
          )}
          {metrics.averageTicket !== null && (
            <>
              <dt className="opacity-70">Ticket médio</dt>
              <dd className="tabular-nums">
                {formatBrl(metrics.averageTicket)}
              </dd>
            </>
          )}
          <dt className="opacity-70">Pedidos</dt>
          <dd className="tabular-nums">
            {metrics.orders.toLocaleString("pt-BR")}
          </dd>
          <dt className="opacity-70">Clientes</dt>
          <dd className="tabular-nums">
            {metrics.customers.toLocaleString("pt-BR")} atendidos
          </dd>
        </dl>
      </TooltipContent>
    </Tooltip>
  );
}

export function SalesGoalRankRow({
  entry,
  position,
  showScore,
  showPercent,
  showSoldValue = true,
  accent = "#7a1fe7",
  canEdit = false,
  featured = false,
  textOnDark = true,
}: {
  entry: SalesGoalRankEntry;
  position: number;
  showScore: boolean;
  showPercent: boolean;
  showSoldValue?: boolean;
  accent?: string;
  canEdit?: boolean;
  featured?: boolean;
  textOnDark?: boolean;
}) {
  const upsertEntry = useUpsertSalesGoalEntry();
  const percent = Math.min(entry.percentAchieved ?? 0, 100);
  // Sem meta cadastrada, `remainingAmount` é 0 e todo mundo apareceria como
  // "meta batida" — o que é falso e some com a leitura do board logo depois do
  // sync, quando o vendido já existe mas a planilha de metas ainda não chegou.
  const hasGoal = entry.goalAmount > 0;
  const goalReached =
    hasGoal && entry.remainingAmount <= 0 && entry.achievedAmount !== null;
  const medal = featured ? (MEDALS[position] ?? null) : null;

  if (featured) {
    return (
      <SellerMetricsTooltip entry={entry}>
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border-2 px-4 py-3 min-w-0"
          style={{ borderColor: medal?.border ?? accent }}
        >
          <span
            className="w-6 text-center text-xl font-black shrink-0"
            style={{ color: medal?.text ?? accent }}
          >
            {position}
          </span>

          <SalesGoalAvatar
            name={entry.sellerName}
            seed={entry.externalCode}
            photoUrl={entry.photoUrl}
            size={56}
          />

          <div className="flex-1 min-w-[170px] overflow-hidden">
            <div className="flex items-center gap-1.5 min-w-0">
              <p
                className={cn(
                  "text-sm font-bold truncate min-w-0",
                  textOnDark && "text-white",
                )}
              >
                {entry.goalName}
              </p>
              <Badge
                variant={entry.entryKind === "BUCKET" ? "secondary" : "outline"}
                className="text-[8px] px-1 py-0 shrink-0 hidden @sm:inline-flex"
              >
                {entry.entryKind === "BUCKET" ? "BUCKET" : "VENDEDOR"}
              </Badge>
            </div>
            <AmountLine
              label="Meta"
              value={entry.goalAmount}
              editable={canEdit}
              fieldLabel={`Meta de ${entry.sellerName}`}
              onCommit={(goalAmount) =>
                upsertEntry.mutate({ entryId: entry.id, goalAmount })
              }
              className={cn(
                "text-xs mt-1",
                textOnDark ? "text-white/70" : "text-muted-foreground",
              )}
            />
            {showSoldValue && (
              <AmountLine
                label="Vendido"
                value={entry.achievedAmount}
                // Editável mesmo com vínculo: o valor digitado vira override
                // manual do vendido automático (desfaz-se no ↺ das Configurações).
                editable={canEdit}
                fieldLabel={`Vendido de ${entry.sellerName}`}
                onCommit={(achievedAmount) =>
                  upsertEntry.mutate({ entryId: entry.id, achievedAmount })
                }
                className={cn(
                  "text-xs",
                  textOnDark ? "text-white/70" : "text-muted-foreground",
                )}
              />
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5 min-w-[110px] shrink-0">
            <div className="flex items-center gap-1.5">
              {showScore && (
                <span
                  className="text-xs font-bold tabular-nums whitespace-nowrap"
                  style={{ color: medal?.text ?? accent }}
                >
                  {Math.round(entry.percentAchieved ?? 0)} pts
                </span>
              )}
              {entry.achievedSource === "AUTO" && (
                <span
                  title="Vendido calculado automaticamente das vendas"
                  className="flex items-center justify-center size-5 rounded-md bg-white/10 shrink-0"
                >
                  <Link2 className="size-3 text-muted-foreground" />
                </span>
              )}
            </div>
            <Progress
              value={percent}
              className="h-1.5 w-full bg-white/10 [&>div]:bg-(--progress-fill)"
              style={{ ["--progress-fill" as string]: medal?.border ?? accent }}
            />
            {showPercent && (
              <span
                className="text-[10px] tabular-nums"
                style={{ color: medal?.text ?? accent }}
              >
                {entry.percentAchieved !== null
                  ? `${entry.percentAchieved.toFixed(0)}%`
                  : "—"}
              </span>
            )}
            <span
              className={cn(
                "text-[10px] truncate whitespace-nowrap",
                goalReached
                  ? "text-emerald-500 font-semibold"
                  : textOnDark
                    ? "text-white/60"
                    : "text-muted-foreground",
              )}
            >
              {!hasGoal
                ? "Sem meta definida"
                : goalReached
                  ? "🎉 Meta batida"
                  : `Faltam ${formatBrl(entry.remainingAmount)}`}
            </span>
          </div>
        </div>
      </SellerMetricsTooltip>
    );
  }

  return (
    <SellerMetricsTooltip entry={entry}>
      <div className="flex items-start gap-2 px-2 py-2 rounded-xl border border-transparent hover:bg-white/5 transition-all min-w-0">
        <span
          className={cn(
            "w-5 text-center text-sm font-bold shrink-0",
            textOnDark ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {position}
        </span>

        <SalesGoalAvatar
          name={entry.sellerName}
          seed={entry.externalCode}
          photoUrl={entry.photoUrl ? constructUrl(entry.photoUrl) : null}
          size={32}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <p
              className={cn(
                "text-xs font-semibold truncate min-w-0",
                textOnDark && "text-white",
              )}
            >
              {entry.goalName}
            </p>
            <Badge
              variant={entry.entryKind === "BUCKET" ? "secondary" : "outline"}
              className="text-[8px] px-1 py-0 shrink-0 hidden @sm:inline-flex"
            >
              {entry.entryKind === "BUCKET" ? "BUCKET" : "VENDEDOR"}
            </Badge>
          </div>
          {canEdit ? (
            <div
              className={cn(
                "flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] min-w-0",
                textOnDark ? "text-white/70" : "text-muted-foreground",
              )}
            >
              <span>Meta</span>
              <InlineAmountInput
                value={entry.goalAmount}
                label={`Meta de ${entry.sellerName}`}
                onCommit={(goalAmount) =>
                  upsertEntry.mutate({ entryId: entry.id, goalAmount })
                }
              />
              {showSoldValue && (
                <>
                  <span>· Vendido</span>
                  {canEdit ? (
                    <InlineAmountInput
                      value={entry.achievedAmount ?? 0}
                      label={`Vendido de ${entry.sellerName}`}
                      onCommit={(achievedAmount) =>
                        upsertEntry.mutate({
                          entryId: entry.id,
                          achievedAmount,
                        })
                      }
                    />
                  ) : (
                    <span>
                      {entry.achievedAmount !== null
                        ? formatBrl(entry.achievedAmount)
                        : "—"}
                    </span>
                  )}
                </>
              )}
            </div>
          ) : (
            <p
              className={cn(
                "text-[10px] truncate",
                textOnDark ? "text-white/70" : "text-muted-foreground",
              )}
            >
              Meta {formatBrl(entry.goalAmount)}
              {showSoldValue && (
                <>
                  {" "}
                  · Vendido{" "}
                  {entry.achievedAmount !== null
                    ? formatBrl(entry.achievedAmount)
                    : "—"}
                </>
              )}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1 min-w-0">
            <Progress
              value={percent}
              className="h-1.5 flex-1 min-w-6 max-w-24 bg-white/10 [&>div]:bg-(--progress-fill)"
              style={{ ["--progress-fill" as string]: accent }}
            />
            {showPercent && (
              <span
                className="text-[9px] tabular-nums shrink-0"
                style={{ color: accent }}
              >
                {entry.percentAchieved !== null
                  ? `${entry.percentAchieved.toFixed(0)}%`
                  : "—"}
              </span>
            )}
          </div>
          <span
            className={cn(
              "text-[9px] truncate block",
              goalReached
                ? "text-emerald-500 font-semibold"
                : textOnDark
                  ? "text-white/60"
                  : "text-muted-foreground",
            )}
          >
            {!hasGoal
              ? "Sem meta definida"
              : goalReached
                ? "🎉 Meta batida"
                : `Faltam ${formatBrl(entry.remainingAmount)}`}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1 shrink-0">
          {showScore && (
            <span
              className="text-[11px] font-bold tabular-nums whitespace-nowrap"
              style={{ color: accent }}
            >
              {Math.round(entry.percentAchieved ?? 0)} pts
            </span>
          )}
          {entry.achievedSource === "AUTO" && (
            <span
              title="Vendido calculado automaticamente das vendas"
              className="flex items-center justify-center size-5 rounded-md bg-white/10 shrink-0"
            >
              <Link2 className="size-3 text-muted-foreground" />
            </span>
          )}
        </div>
      </div>
    </SellerMetricsTooltip>
  );
}
