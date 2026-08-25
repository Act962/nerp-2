"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check, RotateCcw } from "lucide-react";
import { useState } from "react";
import {
  contrastInkFor,
  isValidHex,
  RACK_COLOR_SWATCHES,
} from "../engine/rack-colors";

/**
 * O campo hexadecimal precisa de rascunho local: só propaga quando o valor está
 * completo, mas sem guardar o que foi digitado seria impossível chegar lá — um
 * "#20409" intermediário nunca apareceria na tela.
 */
function HexInput({
  label,
  valueHex,
  onChange,
}: {
  label: string;
  valueHex: string;
  onChange: (hex: string) => void;
}) {
  const [draft, setDraft] = useState(valueHex);
  const [lastApplied, setLastApplied] = useState(valueHex);

  // Cor trocada por fora (amostra, seletor nativo, undo): o rascunho acompanha.
  if (valueHex !== lastApplied) {
    setLastApplied(valueHex);
    setDraft(valueHex);
  }

  return (
    <input
      value={draft}
      spellCheck={false}
      maxLength={7}
      aria-label={`${label} em hexadecimal`}
      className="h-7 w-full rounded border bg-transparent px-2 font-mono text-xs uppercase"
      onChange={(event) => {
        const next = event.target.value.trim();
        setDraft(next);
        if (isValidHex(next)) {
          setLastApplied(next);
          onChange(next);
        }
      }}
      onBlur={() => setDraft(valueHex)}
    />
  );
}

interface ColorFieldProps {
  label: string;
  /** null = herdando o padrão; a amostra "Padrão" fica marcada. */
  valueHex: string | null;
  defaultHex: string;
  onChange: (hex: string | null) => void;
}

export function ColorField({
  label,
  valueHex,
  defaultHex,
  onChange,
}: ColorFieldProps) {
  const activeHex = valueHex ?? defaultHex;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {valueHex !== null && (
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => onChange(null)}
          >
            <RotateCcw className="size-3" />
            Padrão
          </button>
        )}
      </div>

      <div className="grid grid-cols-8 gap-1">
        {RACK_COLOR_SWATCHES.map((swatch) => (
          <button
            key={swatch.hex}
            type="button"
            title={swatch.label}
            aria-label={swatch.label}
            className={cn(
              "flex aspect-square items-center justify-center rounded border transition-transform hover:scale-110",
              activeHex.toLowerCase() === swatch.hex.toLowerCase()
                ? "border-foreground"
                : "border-border",
            )}
            style={{ backgroundColor: swatch.hex }}
            onClick={() => onChange(swatch.hex)}
          >
            {activeHex.toLowerCase() === swatch.hex.toLowerCase() && (
              <Check
                className="size-3"
                style={{ color: contrastInkFor(swatch.hex) }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={activeHex}
          aria-label={`${label} personalizada`}
          className="h-7 w-9 cursor-pointer rounded border bg-transparent p-0.5"
          onChange={(event) => onChange(event.target.value)}
        />
        <HexInput label={label} valueHex={activeHex} onChange={onChange} />
      </div>
    </div>
  );
}
