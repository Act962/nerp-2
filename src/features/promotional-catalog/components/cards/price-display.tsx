import { unitLabel } from "@/features/products/lib/units";
import { cn } from "@/lib/utils";
import type { PriceStyle } from "../../types";
import { formatPrice } from "./price-badge";

interface PriceDisplayProps {
  price: number;
  unit?: string;
  showUnit?: boolean;
  style: PriceStyle;
  /** Cor do texto no modo "plain" (herda a cor do card). */
  textColor: string;
  fontSize?: string;
  fontWeight?: string;
  className?: string;
}

// Preço ativo do card com estilo de destaque (sem borda / com borda / fundo)
// e a unidade opcional. `accent` é a borda (boxed) ou o fundo (highlight).
export function PriceDisplay({
  price,
  unit,
  showUnit = true,
  style,
  textColor,
  fontSize,
  fontWeight,
  className,
}: PriceDisplayProps) {
  const suffix =
    showUnit && unit ? (
      <span className="ml-0.5 text-[0.7em] font-normal opacity-80">
        /{unitLabel(unit)}
      </span>
    ) : null;

  // Escala o tamanho do preço mantendo a unidade CSS (rem) via calc.
  const size = style.size ?? 1;
  const fs = fontSize && size !== 1 ? `calc(${fontSize} * ${size})` : fontSize;

  // "Remover contorno do box de preço": cai para o modo simples (só texto).
  if (style.variant === "boxed" && !style.hideBorder) {
    return (
      <span
        className={cn(
          "inline-flex items-baseline rounded border-2 px-1.5 py-0.5",
          className,
        )}
        style={{
          borderColor: style.accent,
          color: style.text,
          fontSize: fs,
          fontWeight,
        }}
      >
        {formatPrice(price)}
        {suffix}
      </span>
    );
  }

  if (style.variant === "highlight" && !style.hideBorder) {
    return (
      <span
        className={cn(
          "inline-flex items-baseline rounded px-1.5 py-0.5",
          className,
        )}
        style={{
          backgroundColor: style.accent,
          color: style.text,
          fontSize: fs,
          fontWeight,
        }}
      >
        {formatPrice(price)}
        {suffix}
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-baseline", className)}
      style={{ color: textColor, fontSize: fs, fontWeight }}
    >
      {formatPrice(price)}
      {suffix}
    </span>
  );
}
