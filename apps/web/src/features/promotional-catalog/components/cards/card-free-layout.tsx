"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { constructUrl } from "@/hooks/use-construct-url";
import { unitLabel } from "@/features/products/lib/units";
import type { CardLayoutElement, CatalogProduct } from "../../types";
import { cardImageSrc } from "./image-style";
import { formatPrice } from "./price-badge";

// Texto da variável resolvido do produto.
function variableText(el: CardLayoutElement, product: CatalogProduct): string {
  // Texto fixo digitado (ex.: "UND", "cada").
  if (el.kind === "text") return el.text ?? "";
  const active = product.promotionalPrice ?? product.salePrice;
  switch (el.variable) {
    case "name":
      return product.name;
    case "priceActive":
      return formatPrice(active);
    case "priceCurrency":
      return "R$";
    case "priceReais":
      return String(Math.floor(active));
    case "priceCents":
      return `,${String(Math.round((active - Math.floor(active)) * 100)).padStart(2, "0")}`;
    case "priceFrom":
      // Preço normal EFETIVO ("De" riscado) — reflete o priceOverride do catálogo.
      return formatPrice(product.salePrice);
    case "unit":
      return unitLabel(product.unit);
    case "sku":
      return product.sku;
    case "discountPct":
      return product.discount != null
        ? `${Math.round(product.discount)}% OFF`
        : "";
    case "savings":
      return product.savings != null
        ? `Economize ${formatPrice(product.savings)}`
        : "";
    case "category":
      return product.categoryName ?? "";
    default:
      return "";
  }
}

interface CardFreeLayoutProps {
  product: CatalogProduct;
  elements: CardLayoutElement[];
  // Data URL da foto (proxy same-origin, para o export com html-to-image).
  thumbSrc?: string;
  // Data URLs das imagens FIXAS da etiqueta (kind "image"), por chave R2 —
  // mesma razão do `thumbSrc`: sem elas o html-to-image não embute a imagem
  // (cross-origin) e ela sai em branco no PNG/PDF.
  imageSrcs?: Record<string, string>;
  // Estilo da foto (contorno/sombra/fundo) — toggles de IMAGEM do painel.
  photoBox?: CSSProperties;
  // Proporção do card (default 1:1).
  aspectRatio?: string;
}

// Renderiza o card montado no editor livre: cada elemento posicionado em fração
// do card, com a fonte escalando pela altura medida (funciona no preview e no
// export). Usado por `renderCard` quando `config.cardLayout` tem elementos.
export function CardFreeLayout({
  product,
  elements,
  thumbSrc,
  imageSrcs,
  photoBox,
  aspectRatio = "1 / 1",
}: CardFreeLayoutProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setH(el.getBoundingClientRect().height);
    const ro = new ResizeObserver(([entry]) => setH(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sorted = [...elements].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden"
      style={{ aspectRatio }}
    >
      {sorted.map((el) => {
        const base: CSSProperties = {
          position: "absolute",
          left: `${el.x * 100}%`,
          top: `${el.y * 100}%`,
          width: `${el.w * 100}%`,
          height: `${el.h * 100}%`,
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          opacity: el.opacity ?? 1,
        };

        if (el.kind === "shape") {
          return (
            <div
              key={el.id}
              style={{
                ...base,
                background: el.fill,
                // Borda (contorno) opcional — mesma convenção do box de texto.
                border:
                  (el.outlineWidth ?? 0) > 0
                    ? `${(el.outlineWidth ?? 0) * h}px solid ${el.outlineColor ?? "#111111"}`
                    : undefined,
                // Raio uniforme em px (fração da altura do card) — não distorce
                // quando o retângulo cresce para os lados.
                borderRadius:
                  el.shape === "circle"
                    ? "9999px"
                    : `${(el.radius ?? 0) * h}px`,
              }}
            />
          );
        }

        // Imagem FIXA da etiqueta (biblioteca) — não é a foto do produto.
        if (el.kind === "image") {
          if (!el.imageKey) return null;
          const src = imageSrcs?.[el.imageKey] ?? constructUrl(el.imageKey);
          return (
            <div
              key={el.id}
              style={{
                ...base,
                overflow: "hidden",
                borderRadius: `${(el.radius ?? 0) * h}px`,
              }}
            >
              {/* biome-ignore lint/performance/noImgElement: card exportado via html-to-image */}
              <img src={src} alt="" className="h-full w-full object-contain" />
            </div>
          );
        }

        if (el.variable === "photo") {
          const src = cardImageSrc(thumbSrc, product);
          return (
            <div
              key={el.id}
              style={{
                ...base,
                ...photoBox,
                overflow: "hidden",
                borderRadius: 6,
              }}
            >
              {/* biome-ignore lint/performance/noImgElement: card exportado via html-to-image */}
              <img src={src} alt="" className="h-full w-full object-contain" />
            </div>
          );
        }

        const fontSize = (el.fontFrac ?? 0.08) * h;
        const boxPad = el.boxed ? `${0.03 * h}px ${0.05 * h}px` : undefined;
        return (
          <div
            key={el.id}
            style={{
              ...base,
              color: el.color,
              fontSize,
              fontWeight: el.fontWeight,
              fontFamily: el.fontFamily,
              lineHeight: 1.05,
              display: "flex",
              alignItems: "center",
              justifyContent:
                el.align === "center"
                  ? "center"
                  : el.align === "right"
                    ? "flex-end"
                    : "flex-start",
              textAlign: el.align,
              overflow: "hidden",
              whiteSpace: "pre-wrap",
              textDecoration:
                el.variable === "priceFrom" ? "line-through" : undefined,
              // Caixa opcional (fundo + borda) ao redor do texto.
              background: el.boxed ? el.fill : undefined,
              border:
                el.boxed && (el.outlineWidth ?? 0) > 0
                  ? `${(el.outlineWidth ?? 0) * h}px solid ${el.outlineColor ?? "#000000"}`
                  : undefined,
              borderRadius: el.boxed ? `${(el.radius ?? 0) * h}px` : undefined,
              padding: boxPad,
            }}
          >
            {variableText(el, product)}
          </div>
        );
      })}
    </div>
  );
}
