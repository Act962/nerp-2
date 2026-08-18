"use client";

import { forwardRef, useRef, useState, useEffect } from "react";
import type { CatalogConfig, CatalogProduct } from "../types";
import { TEXT_SIZE_CSS } from "../types";
import { CardStandard } from "./cards/card-standard";
import { CardCompact } from "./cards/card-compact";
import { CardList } from "./cards/card-list";
import { CardMinimal } from "./cards/card-minimal";
import { getContrastColor } from "@/utils/get-contrast-color";
import { constructUrl } from "@/hooks/use-construct-url";

export type SupplierLogo = { id: string; name: string; logo: string };

interface CatalogPreviewProps {
  config: CatalogConfig;
  products: CatalogProduct[];
  supplierLogos?: SupplierLogo[];
}

const gridClass: Record<string, string> = {
  "grid-2": "grid grid-cols-2 gap-4",
  "grid-3": "grid grid-cols-3 gap-4",
  "grid-4": "grid grid-cols-4 gap-3",
  list: "flex flex-col gap-3",
  featured: "flex flex-col gap-4",
  carousel: "flex gap-4 overflow-x-auto",
  masonry: "columns-3 gap-4",
  table: "flex flex-col gap-0",
};

function renderCard(product: CatalogProduct, config: CatalogConfig) {
  const cardStyle = { backgroundColor: config.cardColor };
  const cardColor = config.cardColor;
  const textConfig = { textSize: config.textSize, fontWeight: config.fontWeight };
  switch (config.cardStyle) {
    case "compact":
      return (
        <CardCompact
          key={product.id}
          product={product}
          cardStyle={cardStyle}
          cardColor={cardColor}
          config={textConfig}
        />
      );
    case "list":
      return (
        <CardList
          key={product.id}
          product={product}
          cardStyle={cardStyle}
          cardColor={cardColor}
          config={{ showCategory: config.showCategory, showStock: config.showStock, ...textConfig }}
        />
      );
    case "minimal":
      return (
        <CardMinimal
          key={product.id}
          product={product}
          cardStyle={cardStyle}
          cardColor={cardColor}
          config={textConfig}
        />
      );
    default:
      return (
        <CardStandard
          key={product.id}
          product={product}
          cardStyle={cardStyle}
          cardColor={cardColor}
          config={{
            showDescription: config.showDescription,
            showCategory: config.showCategory,
            showStock: config.showStock,
            showSku: config.showSku,
            ...textConfig,
          }}
        />
      );
  }
}

const PAGE_W = 1080;
const PAGE_H: Record<CatalogConfig["pageSize"], number> = {
  square: 1080,
  story: 1920,
};

export const CatalogPreview = forwardRef<HTMLDivElement, CatalogPreviewProps>(
  ({ config, products, supplierLogos = [] }, ref) => {
    const outerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [bgDataUrl, setBgDataUrl] = useState<string>("");

    const pageH = PAGE_H[config.pageSize];

    useEffect(() => {
      const el = outerRef.current;
      if (!el) return;
      const observer = new ResizeObserver(([entry]) => {
        setScale(entry.contentRect.width / PAGE_W);
      });
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      const key = config.backgroundImage;
      if (!key) {
        setBgDataUrl("");
        return;
      }
      let cancelled = false;
      fetch(`/api/s3/image?key=${encodeURIComponent(key)}`)
        .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`${res.status}`))))
        .then(
          (blob) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error("FileReader error"));
              reader.readAsDataURL(blob);
            }),
        )
        .then((dataUrl) => {
          if (!cancelled) setBgDataUrl(dataUrl);
        })
        .catch(() => {
          if (!cancelled) setBgDataUrl(constructUrl(key));
        });
      return () => {
        cancelled = true;
      };
    }, [config.backgroundImage]);

    const isFeatured = config.layout === "featured";
    const titleColor = getContrastColor(config.backgroundColor);
    const cardStyle = { backgroundColor: config.cardColor };
    const cardColor = config.cardColor;

    const mid = Math.ceil(supplierLogos.length / 2);
    const logosLeft = supplierLogos.slice(0, mid);
    const logosRight = supplierLogos.slice(mid);

    // O transform fica no wrapper intermediário, nunca no ref exportado.
    // html-to-image usa getBoundingClientRect() no ref — se ele tivesse
    // scale aplicado, o canvas de captura seria menor que 1080px e
    // cliparia o conteúdo à direita.
    return (
      <div
        ref={outerRef}
        className="rounded-lg overflow-hidden"
        style={{ aspectRatio: `${PAGE_W}/${pageH}`, position: "relative" }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: PAGE_W,
            height: pageH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <div
            ref={ref}
            style={{
              width: PAGE_W,
              height: pageH,
              overflow: "hidden",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
              backgroundColor: config.backgroundColor,
              backgroundImage: bgDataUrl
                ? `url('${bgDataUrl}')`
                : config.backgroundImage
                  ? `url('${constructUrl(config.backgroundImage)}')`
                  : undefined,
              backgroundSize: config.backgroundFit,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              paddingTop: config.paddingTop,
              paddingRight: config.paddingRight,
              paddingBottom: config.paddingBottom,
              paddingLeft: config.paddingLeft,
            }}
          >
            <div className="mb-6 text-center shrink-0">
              <h2 className="text-2xl font-bold" style={{ color: titleColor }}>
                {config.title || "Promoções"}
              </h2>
              {config.subtitle && (
                <p className="text-sm mt-1" style={{ color: titleColor, opacity: 0.7 }}>
                  {config.subtitle}
                </p>
              )}
            </div>

            {products.length === 0 ? (
              <div
                className="flex-1 flex items-center justify-center text-sm"
                style={{ color: titleColor, opacity: 0.5 }}
              >
                Nenhum produto promocional encontrado
              </div>
            ) : isFeatured && products.length > 0 ? (
              <div className="flex-1 overflow-hidden flex flex-col gap-4">
                <div className="shrink-0">
                  <CardStandard
                    product={products[0]}
                    cardStyle={cardStyle}
                    cardColor={cardColor}
                    config={{
                      showDescription: config.showDescription,
                      showCategory: config.showCategory,
                      showStock: config.showStock,
                      showSku: config.showSku,
                      textSize: config.textSize,
                      fontWeight: config.fontWeight,
                    }}
                  />
                </div>
                <div className={gridClass["grid-3"]}>
                  {products.slice(1).map((p) => renderCard(p, config))}
                </div>
              </div>
            ) : (
              <div className={gridClass[config.layout] ?? "grid grid-cols-3 gap-4"}>
                {products.map((p) => renderCard(p, config))}
              </div>
            )}

            {config.footerText && (
              <div
                className="mt-4 text-center shrink-0"
                style={{ color: titleColor, opacity: 0.6, fontSize: TEXT_SIZE_CSS[config.footerTextSize ?? "xs"] }}
              >
                {config.footerText}
              </div>
            )}

            {logosLeft.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: config.paddingBottom,
                  left: config.paddingLeft,
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 12,
                }}
              >
                {logosLeft.map((s) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={s.id} src={constructUrl(s.logo)} alt={s.name} style={{ height: 56, maxWidth: 140, objectFit: "contain" }} />
                ))}
              </div>
            )}

            {logosRight.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: config.paddingBottom,
                  right: config.paddingRight,
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 12,
                }}
              >
                {logosRight.map((s) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={s.id} src={constructUrl(s.logo)} alt={s.name} style={{ height: 56, maxWidth: 140, objectFit: "contain" }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

CatalogPreview.displayName = "CatalogPreview";
