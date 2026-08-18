"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Alvos de toque de app no celular (44px) que encolhem pro tamanho denso do
// desktop. `text-base` no mobile não é estética: abaixo de 16px o iOS dá zoom
// automático ao focar o campo e desloca o canvas do editor.
export const EDITOR_FIELD_CLASS = "h-11 text-base md:h-9 md:text-sm";
export const EDITOR_BUTTON_CLASS = "h-11 md:h-9";

// O SelectTrigger do shadcn fixa a altura em `data-[size=default]:h-9`, que
// tem especificidade maior que uma classe de altura solta — sem o modificador
// `!` o seletor de fonte ficaria com 36px de alvo no celular.
export const EDITOR_SELECT_CLASS = "h-11! text-base md:h-9! md:text-sm";

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ColorField({
  label,
  value,
  onChange,
  className,
}: ColorFieldProps) {
  // O seletor nativo só aceita #rrggbb. Cores vindas do layout podem ter alpha
  // (#rrggbbaa) ou vir vazias, então normaliza antes de alimentar o input.
  const safeValue = HEX_PATTERN.test(value) ? value : "#000000";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          className="size-11 shrink-0 cursor-pointer rounded-md border bg-transparent p-1 md:size-9"
          value={safeValue}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(EDITOR_FIELD_CLASS, "font-mono uppercase")}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: NumberFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (!Number.isNaN(parsed)) onChange(parsed);
        }}
        className={EDITOR_FIELD_CLASS}
      />
    </div>
  );
}
