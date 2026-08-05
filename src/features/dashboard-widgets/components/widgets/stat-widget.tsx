"use client";

import { cn } from "@/lib/utils";
import { pastelHex, type WidgetColor } from "../../lib/pastel-colors";
import {
  alignClass,
  justifyClass,
  valueFontSize,
  weightClass,
  type WidgetAlign,
  type WidgetTextSize,
  type WidgetTextWeight,
} from "../../lib/widget-appearance";
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
  valueAlign = "left",
  valueColor,
  valueSize = "md",
  valueWeight = "semibold",
  iconColor,
  sparkline,
}: {
  value: Extract<WidgetValue, { kind: "STAT" }>;
  icon?: string | null;
  progressPercent?: number;
  /** Alinhamento horizontal do número — a barra de progresso segue no fim. */
  valueAlign?: WidgetAlign;
  /** Cor do número; null = herdar do tema. */
  valueColor?: WidgetColor | null;
  /**
   * Escala aplicada sobre o `clamp` responsivo. `md` = tamanho antigo. Passa
   * por `valueFontSize` porque o número precisa continuar encolhendo/crescendo
   * com o card — não é um px fixo.
   */
  valueSize?: WidgetTextSize;
  /** Peso do número. `semibold` = comportamento antigo. */
  valueWeight?: WidgetTextWeight;
  /** Cor do ícone e do círculo em volta; null = tom padrão (primary). */
  iconColor?: WidgetColor | null;
  /**
   * Série curta de valores (últimos N pontos) — se presente, é desenhada
   * como polyline SVG discreta ABAIXO do número. Usa a `valueColor` como
   * tom quando definida, senão o `primary` do tema.
   */
  sparkline?: number[];
}) {
  const Icon = widgetIcon(icon);
  const valueHex = pastelHex(valueColor);
  const iconHex = pastelHex(iconColor);
  return (
    <div className="@container flex h-full flex-col justify-center gap-1">
      <div
        className={cn(
          "flex min-w-0 items-center gap-2",
          justifyClass(valueAlign),
        )}
      >
        {Icon && (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full",
              !iconHex && "bg-primary/10 text-primary",
            )}
            style={
              iconHex
                ? { background: `${iconHex}33`, color: iconHex }
                : undefined
            }
          >
            <Icon className="size-3.5" />
          </span>
        )}
        <p
          className={cn(
            // `flex-1` só quando ancora à esquerda: com center/right o número
            // deixa de esticar e o alinhamento passa a mandar de fato.
            // `leading-none` + `py-0.5` — antes era `leading-tight` (≈1.25),
            // que dava altura de linha maior que a viewport do card em
            // `valueSize=lg/xl` e o `overflow-hidden` do CardContent decepava
            // a parte de baixo do "R$" (descendente do "$"/"g"). O padding
            // vertical evita que o topo do glifo cole na borda também.
            "min-w-0 tabular-nums leading-none py-0.5",
            weightClass(valueWeight),
            valueAlign === "left" && "flex-1",
            alignClass(valueAlign),
          )}
          style={{
            fontSize: valueFontSize(valueSize),
            ...(valueHex ? { color: valueHex } : {}),
          }}
        >
          {formatWidgetValue(value.value, value.unit)}
        </p>
        {progressPercent !== undefined && (
          <ProgressRing percent={progressPercent} />
        )}
      </div>
      {value.deltaLabel && (
        <p
          className={cn(
            "text-muted-foreground text-xs",
            alignClass(valueAlign),
          )}
        >
          {value.deltaLabel}
        </p>
      )}
      {sparkline && sparkline.length >= 2 && (
        <Sparkline points={sparkline} color={valueHex ?? "currentColor"} />
      )}
    </div>
  );
}

/**
 * Sparkline SVG minimalista — normaliza os pontos para o viewBox 100×24 e
 * desenha uma polyline. Sem eixos, sem labels: é indicador de tendência,
 * não gráfico. Fica na base do StatWidget para dar contexto do "vs. ontem"
 * sem ocupar espaço vertical significativo.
 */
function Sparkline({ points, color }: { points: number[]; color: string }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 100;
  const height = 24;
  const step = width / (points.length - 1);
  const path = points
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPath = `${path} L${width},${height} L0,${height} Z`;
  return (
    <svg
      className="mt-1 h-6 w-full opacity-70"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Tendência recente"
    >
      <path d={areaPath} fill={color} fillOpacity={0.15} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
