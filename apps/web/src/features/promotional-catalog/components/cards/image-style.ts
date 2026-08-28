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
function transformFromAdjust(
  adjust: ImageAdjustment | undefined,
): string | undefined {
  if (!adjust) return undefined;
  const partes: string[] = [];
  if (adjust.scale !== 1) partes.push(`scale(${adjust.scale})`);
  if (adjust.rotation) partes.push(`rotate(${adjust.rotation}deg)`);
  return partes.length > 0 ? partes.join(" ") : undefined;
}

export function imageStyleFromAdjust(
  adjust: ImageAdjustment | undefined,
): CSSProperties {
  return {
    // Padrão "caber" (contain): é o enquadramento usado em todos os produtos.
    // Preencher (cover) cortava a foto e escondia embalagem/gramatura.
    objectFit: adjust?.fit ?? "contain",
    objectPosition: adjust ? `${adjust.posX}% ${adjust.posY}%` : undefined,
    // Zoom e giro na MESMA transformação: dois `transform` no mesmo elemento se
    // sobrescrevem, e o segundo apagaria o primeiro.
    transform: transformFromAdjust(adjust),
  };
}
