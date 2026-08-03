"use client";

import { Input } from "@/components/ui/input";
import { useState } from "react";

export interface DateRange {
  /** ISO (YYYY-MM-DD) inclusivo; vazio = sem limite. */
  from?: string;
  to?: string;
}

/**
 * Converte os dias escolhidos em instantes ISO, usando o fuso DO APARELHO.
 *
 * O servidor roda em UTC; se ele interpretasse "2026-08-01" sozinho, o dia do
 * promotor em Teresina (UTC-3) começaria às 21h do dia anterior e "Hoje" viria
 * com as fotos erradas nas duas pontas.
 */
export function rangeToInstants(range: DateRange): {
  from?: string;
  to?: string;
} {
  return {
    from: range.from
      ? new Date(`${range.from}T00:00:00`).toISOString()
      : undefined,
    to: range.to
      ? new Date(`${range.to}T23:59:59.999`).toISOString()
      : undefined,
  };
}

type PresetKey = "ALL" | "TODAY" | "7D" | "30D" | "MONTH" | "CUSTOM";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "ALL", label: "Tudo" },
  { key: "TODAY", label: "Hoje" },
  { key: "7D", label: "7 dias" },
  { key: "30D", label: "30 dias" },
  { key: "MONTH", label: "Este mês" },
  { key: "CUSTOM", label: "Período" },
];

function isoDay(date: Date): string {
  // Local, não UTC: `toISOString` em Teresina (UTC-3) devolve o dia seguinte a
  // partir das 21h, e o promotor perderia as fotos que acabou de tirar.
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function rangeFor(key: PresetKey): DateRange {
  const today = new Date();
  const daysAgo = (days: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() - days);
    return isoDay(date);
  };

  switch (key) {
    case "TODAY":
      return { from: isoDay(today), to: isoDay(today) };
    case "7D":
      return { from: daysAgo(6), to: isoDay(today) };
    case "30D":
      return { from: daysAgo(29), to: isoDay(today) };
    case "MONTH":
      return {
        from: isoDay(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: isoDay(today),
      };
    default:
      return {};
  }
}

/** Filtro de data por atalhos, com período livre quando nenhum atalho serve. */
export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [preset, setPreset] = useState<PresetKey>("ALL");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => {
              setPreset(option.key);
              if (option.key !== "CUSTOM") onChange(rangeFor(option.key));
            }}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              preset === option.key
                ? "border-foreground bg-foreground text-background"
                : "hover:bg-accent"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {preset === "CUSTOM" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={value.from ?? ""}
            max={value.to || undefined}
            onChange={(event) =>
              onChange({ ...value, from: event.target.value || undefined })
            }
            className="h-9"
            aria-label="Data inicial"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            value={value.to ?? ""}
            min={value.from || undefined}
            onChange={(event) =>
              onChange({ ...value, to: event.target.value || undefined })
            }
            className="h-9"
            aria-label="Data final"
          />
        </div>
      )}
    </div>
  );
}
