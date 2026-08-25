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
import { cn } from "@/lib/utils";
import { cardImageSrc, imageStyleFromAdjust } from "./image-style";

interface CardListProps {
  product: CatalogProduct;
  config: Pick<
    CatalogConfig,
    "showCategory" | "showStock" | "textSize" | "fontWeight"
  >;
  priceStyle: PriceStyle;
  imageBox?: ImageBoxStyle;
  imageAdjust?: ImageAdjustment;
  imageSrc?: string;
  showUnit: boolean;
  cardStyle?: React.CSSProperties;
  cardColor?: string;
}

export function CardList({
  product,
  config,
  priceStyle,
  imageBox,
  imageAdjust,
  imageSrc,
  showUnit,
  cardStyle,
  cardColor = "#ffffff",
}: CardListProps) {
  const imageStyle = imageStyleFromAdjust(imageAdjust);
  const activePrice = product.promotionalPrice ?? product.salePrice;
  const textColor = getContrastColor(cardColor);
  const fontSize = TEXT_SIZE_CSS[config.textSize];
  const fontWeight = FONT_WEIGHT_CSS[config.fontWeight];

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg p-3",
        !imageBox?.hideBorder && "border",
        !imageBox?.hideShadow && "shadow-sm",
      )}
      style={cardStyle}
    >
      <div
        className={cn(
          "relative h-20 w-20 shrink-0 rounded overflow-hidden",
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
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="line-clamp-1"
          style={{ color: textColor, fontSize, fontWeight }}
        >
          {product.name}
        </p>
        {config.showCategory && product.categoryName && (
          <p className="text-xs opacity-60" style={{ color: textColor }}>
            {product.categoryName}
          </p>
        )}
        {config.showStock && (
          <p className="text-xs opacity-60" style={{ color: textColor }}>
            Estoque: {product.currentStock}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-center gap-2 justify-end">
          <PriceBadge discount={product.discount} />
          <PriceDisplay
            price={activePrice}
            unit={product.unit}
            showUnit={showUnit}
            style={priceStyle}
            textColor={textColor}
            fontSize={fontSize}
            fontWeight={fontWeight}
          />
        </div>
        {product.promotionalPrice && (
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
        )}
      </div>
    </div>
  );
}
