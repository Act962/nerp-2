import Image from "next/image";
import type React from "react";
import type {
  CatalogProduct,
  CatalogConfig,
  PriceStyle,
  ImageBoxStyle,
  ImageAdjustment,
} from "../../types";
import { TEXT_SIZE_CSS, FONT_WEIGHT_CSS } from "../../types";
import { PriceBadge, formatPrice } from "./price-badge";
import { PriceDisplay } from "./price-display";
import { getContrastColor } from "@/utils/get-contrast-color";
import { parseDescriptionText } from "./parse-description";
import { cn } from "@/lib/utils";
import { cardImageSrc, imageStyleFromAdjust } from "./image-style";

interface CardStandardProps {
  product: CatalogProduct;
  config: Pick<
    CatalogConfig,
    | "showDescription"
    | "showCategory"
    | "showStock"
    | "showSku"
    | "textSize"
    | "fontWeight"
  >;
  priceStyle: PriceStyle;
  imageBox?: ImageBoxStyle;
  imageAdjust?: ImageAdjustment;
  imageSrc?: string;
  showUnit: boolean;
  cardStyle?: React.CSSProperties;
  cardColor?: string;
}

export function CardStandard({
  product,
  config,
  priceStyle,
  imageBox,
  imageAdjust,
  imageSrc,
  showUnit,
  cardStyle,
  cardColor = "#ffffff",
}: CardStandardProps) {
  const imageStyle = imageStyleFromAdjust(imageAdjust);
  const activePrice = product.promotionalPrice ?? product.salePrice;
  const textColor = getContrastColor(cardColor);
  const descriptionText = parseDescriptionText(product.description);
  const fontSize = TEXT_SIZE_CSS[config.textSize];
  const fontWeight = FONT_WEIGHT_CSS[config.fontWeight];
  const align = priceStyle.align ?? "left";
  const alignItems =
    align === "center" ? "center" : align === "right" ? "flex-end" : undefined;

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg overflow-hidden",
        !imageBox?.hideBorder && "border",
        !imageBox?.hideShadow && "shadow-sm",
      )}
      style={cardStyle}
    >
      <div
        className={cn(
          "relative aspect-square w-full",
          !imageBox?.hideBackground && "bg-muted",
        )}
        style={{
          margin: imageBox?.margin,
          paddingTop: imageBox?.padding?.top,
          paddingRight: imageBox?.padding?.right,
          paddingBottom: imageBox?.padding?.bottom,
          paddingLeft: imageBox?.padding?.left,
        }}
      >
        <div className="relative h-full w-full overflow-hidden">
          <Image
            src={cardImageSrc(imageSrc, product)}
            alt={product.name}
            fill
            unoptimized
            style={imageStyle}
          />
        </div>
        {product.discount && (
          <PriceBadge
            discount={product.discount}
            className="absolute top-2 left-2"
          />
        )}
      </div>
      <div
        className="p-3 flex flex-col gap-1 flex-1"
        style={{ textAlign: align, alignItems }}
      >
        <p
          className="line-clamp-2"
          style={{ color: textColor, fontSize, fontWeight }}
        >
          {product.name}
        </p>
        {config.showCategory && product.categoryName && (
          <p className="text-xs opacity-60" style={{ color: textColor }}>
            {product.categoryName}
          </p>
        )}
        {config.showSku && product.sku && (
          <p className="text-xs opacity-60" style={{ color: textColor }}>
            SKU: {product.sku}
          </p>
        )}
        {config.showDescription && descriptionText && (
          <p
            className="text-xs opacity-60 line-clamp-2"
            style={{ color: textColor }}
          >
            {descriptionText}
          </p>
        )}
        <div className="mt-auto pt-2">
          <PriceDisplay
            price={activePrice}
            unit={product.unit}
            showUnit={showUnit}
            style={priceStyle}
            textColor={textColor}
            fontSize={fontSize}
            fontWeight={fontWeight}
          />
          {product.promotionalPrice && (
            <>
              <p
                className="line-through"
                style={{
                  color: priceStyle.deColor ?? textColor,
                  opacity: priceStyle.deColor ? 1 : 0.5,
                  fontSize: `calc(0.75rem * ${priceStyle.deSize ?? 1})`,
                }}
              >
                {formatPrice(product.salePrice)}
              </p>
              {product.savings && (
                <p
                  className="font-medium"
                  style={{
                    color: priceStyle.savingsColor ?? "#16a34a",
                    fontSize: `calc(0.75rem * ${priceStyle.savingsSize ?? 1})`,
                  }}
                >
                  Economize {formatPrice(product.savings)}
                </p>
              )}
            </>
          )}
        </div>
        {config.showStock && (
          <p className="text-xs opacity-60" style={{ color: textColor }}>
            Estoque: {product.currentStock}
          </p>
        )}
      </div>
    </div>
  );
}
