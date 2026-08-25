import type { CSSProperties } from "react";
import { unitLabel } from "@/features/products/lib/units";
import { cn } from "@/lib/utils";
import type { PriceStyle } from "../../types";
import { formatPrice } from "./price-badge";

// Máscara CSS que recorta semicírculos nas bordas superior/inferior (estilo
// carimbo/etiqueta) — usada na forma "serrilhado".
function serratedMask(r: number): CSSProperties {
  return {
    WebkitMaskImage: `radial-gradient(${r}px at 50% 0, #0000 98%, #000), radial-gradient(${r}px at 50% 100%, #0000 98%, #000), linear-gradient(#000 0 0)`,
    maskImage: `radial-gradient(${r}px at 50% 0, #0000 98%, #000), radial-gradient(${r}px at 50% 100%, #0000 98%, #000), linear-gradient(#000 0 0)`,
    WebkitMaskSize: `${2 * r}px ${r}px, ${2 * r}px ${r}px, 100% calc(100% - ${2 * r}px)`,
    maskSize: `${2 * r}px ${r}px, ${2 * r}px ${r}px, 100% calc(100% - ${2 * r}px)`,
    WebkitMaskPosition: "top, bottom, center",
    maskPosition: "top, bottom, center",
    WebkitMaskRepeat: "repeat-x, repeat-x, no-repeat",
    maskRepeat: "repeat-x, repeat-x, no-repeat",
  };
}

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

  // ── Padrão de estilos de preços (formas): retângulo / arredondado / selo /
  // serrilhado. A forma tem precedência sobre as variantes antigas. ──
  const shape = style.shape ?? "none";
  if (shape !== "none") {
    const fill = style.fill ?? style.accent;
    const outline =
      style.outlineWidth && style.outlineWidth > 0
        ? `${style.outlineWidth}px solid ${style.outlineColor ?? style.accent}`
        : undefined;
    const box: CSSProperties = {
      color: style.text,
      fontSize: fs,
      fontWeight,
      backgroundColor: fill,
      border: outline,
      padding: "0.15em 0.5em",
      lineHeight: 1.1,
    };
    if (shape === "rounded") box.borderRadius = "0.5em";
    else if (shape === "seal") {
      box.borderRadius = "9999px";
      box.aspectRatio = "1";
      box.padding = "0.6em";
    } else if (shape === "serrated") {
      // Padding vertical maior para os recortes não comerem o texto.
      box.padding = "0.4em 0.7em";
      Object.assign(box, serratedMask(5));
    }
    const centered = shape === "seal";
    return (
      <span
        className={cn(
          centered
            ? "inline-flex items-center justify-center"
            : "inline-flex items-baseline",
          className,
        )}
        style={box}
      >
        {formatPrice(price)}
        {suffix}
      </span>
    );
  }

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
