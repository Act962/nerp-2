import type { CSSProperties } from "react";
import type { ImageAdjustment } from "../../types";

// Traduz o ajuste (redimensionar/cortar) da foto do produto em estilo CSS
// aplicado à <Image fill>: `fit` define preencher/caber, `posX/posY` a parte
// visível, `scale` amplia (corta ao ampliar, dentro do overflow-hidden do box).
export function imageStyleFromAdjust(
  adjust: ImageAdjustment | undefined,
): CSSProperties {
  return {
    objectFit: adjust?.fit ?? "cover",
    objectPosition: adjust ? `${adjust.posX}% ${adjust.posY}%` : undefined,
    transform:
      adjust && adjust.scale !== 1 ? `scale(${adjust.scale})` : undefined,
  };
}
