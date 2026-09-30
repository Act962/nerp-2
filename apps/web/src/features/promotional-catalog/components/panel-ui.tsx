"use client";

import { type ReactNode, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { SketchPicker } from "react-color";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ─────────────────────────────────────────────────────────────────────────────
// Design system do painel do editor (catálogo promocional).
// Objetivo: minimalista, arejado e moderno. Mobile = fonte confortável (~15px),
// padrão de app web; no desktop (painel lateral de 360px) fica um pouco mais
// compacto (lg:). Menos texto, mais ícones, cantos suaves e respiro.
// ─────────────────────────────────────────────────────────────────────────────

// Texto base do corpo do painel (mobile 15px / desktop 13px).
export const BODY_TEXT = "text-[15px] leading-snug lg:text-[13px]";

// Cartão de seção — agrupa controles com borda sutil e respiro confortável.
export function SectionCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card/40 p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

// Título de seção — ícone + rótulo curto. Sem "gritar" (nada de uppercase tiny).
export function SectionTitle({
  icon: Icon,
  children,
  action,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-[14px] font-medium text-foreground lg:text-[13px]">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        {children}
      </span>
      {action}
    </div>
  );
}

// Linha rótulo + controle à direita.
export function FieldRow({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        BODY_TEXT,
        className,
      )}
    >
      <span className="min-w-0 text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

// Controle segmentado (pílula) — troca visual limpa entre 2+ opções.
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("flex rounded-xl bg-muted p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-[14px] font-medium transition-all lg:py-1.5 lg:text-[13px]",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Cores prontas do seletor: neutros e os tons mais usados em encarte. */
const CORES_PRONTAS = [
  "#000000",
  "#ffffff",
  "#111111",
  "#f5f5f5",
  "#d0021b",
  "#f5a623",
  "#f8e71c",
  "#7ed321",
  "#417505",
  "#4a90e2",
  "#1e3a8a",
  "#9013fe",
  "#bd10e0",
  "#8b572a",
];

/**
 * Amostra de cor clicável.
 *
 * Abre o seletor do próprio editor, e não o `<input type="color">` do
 * navegador: o nativo não aceita digitar o código da cor, fecha sozinho ao
 * clicar nos campos RGB e, no Tab, tirava o foco do painel e pulava o canvas
 * para a página 1. Aqui o campo "Hex" aceita `#a44550` direto.
 */
export function ColorSwatch({
  value,
  onChange,
  title = "Escolher cor",
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  title?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={title}
          aria-label={title}
          disabled={disabled}
          style={{ background: value }}
          className={cn(
            "relative inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border shadow-sm ring-offset-background transition hover:ring-2 hover:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-40",
            className,
          )}
        />
      </PopoverTrigger>
      <PopoverContent
        className="w-auto border-0 p-0 shadow-xl"
        align="start"
        side="left"
        sideOffset={8}
      >
        <SketchPicker
          color={value}
          disableAlpha
          presetColors={CORES_PRONTAS}
          onChange={(cor) => onChange(cor.hex)}
        />
      </PopoverContent>
    </Popover>
  );
}

// Slider com rótulo + badge do valor.
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className={cn("flex items-center justify-between", BODY_TEXT)}>
        <span className="text-muted-foreground">{label}</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[12px] font-medium tabular-nums text-foreground">
          {format ? format(value) : value}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

/**
 * Número digitável que só aplica ao confirmar (Enter ou sair do campo).
 *
 * Aplicar a cada tecla, com limite mínimo, fazia o campo pular: apagar "120"
 * para digitar "60" passava por "" → 20 no meio do caminho. Aqui o rascunho é
 * livre, o limite vale só no fim e Esc desfaz.
 */
export function NumeroDigitavel({
  value,
  min,
  max,
  onCommit,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (valor: number) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  const mostrado = rascunho ?? String(Math.round(value));

  const confirmar = () => {
    if (rascunho === null) return;
    const numero = Number(rascunho.replace(",", "."));
    setRascunho(null);
    if (!Number.isFinite(numero) || rascunho.trim() === "") return;
    onCommit(Math.min(max, Math.max(min, Math.round(numero))));
  };

  return (
    <input
      inputMode="numeric"
      aria-label={ariaLabel}
      value={mostrado}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setRascunho(null);
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "h-7 rounded-md border bg-transparent px-2 text-center text-xs tabular-nums outline-none focus:ring-2 focus:ring-ring/40",
        className,
      )}
    />
  );
}
