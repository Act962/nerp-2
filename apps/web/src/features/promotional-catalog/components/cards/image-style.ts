import type { CSSProperties } from "react";
import { constructUrl } from "@/hooks/use-construct-url";
import type { CatalogProduct, ImageAdjustment } from "../../types";

// Mockup do sistema para produtos SEM foto (e para a foto exemplo dos estilos).
export const PRODUCT_PLACEHOLDER = "/mockup-produto.webp";

// Src da imagem do card: override explícito (data URL do export) → foto do
// produto → mockup do sistema.
export function cardImageSrc(
  imageSrc: string | undefined,
  product: Pick<CatalogProduct, "thumbnail">,
): string {
  if (imageSrc) return imageSrc;
  return product.thumbnail
    ? constructUrl(product.thumbnail)
    : PRODUCT_PLACEHOLDER;
}

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
