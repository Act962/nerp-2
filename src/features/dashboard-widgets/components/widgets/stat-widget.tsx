"use client";

import { widgetIcon } from "../../lib/widget-icons";
import { formatWidgetValue, type WidgetValue } from "../../lib/widget-value";

const RING_SIZE = 32;
const RING_STROKE = 3.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = RING_CIRCUMFERENCE * (1 - clamped / 100);
  return (
    <div
      className="relative shrink-0"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="-rotate-90"
        role="img"
        aria-label={`${Math.round(Math.min(100, Math.max(0, percent)))}% da meta`}
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={RING_STROKE}
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth={RING_STROKE}
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold tabular-nums">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

// Ícone (opcional) e número sempre na MESMA linha — não empilhado, pra não
// desalinhar o número entre cards com e sem ícone. `@container` + fontSize em
// `cqw` faz o número encolher conforme o card fica mais estreito, em vez de
// vazar/cortar (nunca pode ficar escondido, mesmo em cards pequenos ou
// números longos tipo "R$ 6.000.000,00"). Sem `justify-center`: o número
// ancora sempre no topo do conteúdo, então cards com e sem legenda de delta
// ficam com o número na mesma altura.
export function StatWidget({
  value,
  icon,
  progressPercent,
}: {
  value: Extract<WidgetValue, { kind: "STAT" }>;
  icon?: string | null;
  progressPercent?: number;
}) {
  const Icon = widgetIcon(icon);
  return (
    <div className="@container flex h-full flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2">
        {Icon && (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-3.5" />
          </span>
        )}
        <p
          className="min-w-0 flex-1 font-semibold tabular-nums leading-tight"
          style={{ fontSize: "clamp(1rem, 8cqw, 1.75rem)" }}
        >
          {formatWidgetValue(value.value, value.unit)}
        </p>
        {progressPercent !== undefined && (
          <ProgressRing percent={progressPercent} />
        )}
      </div>
      {value.deltaLabel && (
        <p className="text-xs text-muted-foreground">{value.deltaLabel}</p>
      )}
    </div>
  );
}
