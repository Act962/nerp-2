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
import { PriceBadge } from "./price-badge";
import { PriceDisplay } from "./price-display";
import { getContrastColor } from "@/utils/get-contrast-color";
import { constructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import { imageStyleFromAdjust } from "./image-style";

interface CardMinimalProps {
  product: CatalogProduct;
  config: Pick<CatalogConfig, "textSize" | "fontWeight">;
  priceStyle: PriceStyle;
  imageBox?: ImageBoxStyle;
  imageAdjust?: ImageAdjustment;
  imageSrc?: string;
  showUnit: boolean;
  cardStyle?: React.CSSProperties;
  cardColor?: string;
}

export function CardMinimal({
  product,
  config,
  priceStyle,
  imageBox,
  imageAdjust,
  imageSrc,
  showUnit,
  cardStyle,
  cardColor = "#ffffff",
}: CardMinimalProps) {
  const imageStyle = imageStyleFromAdjust(imageAdjust);
  const activePrice = product.promotionalPrice ?? product.salePrice;
  const textColor = getContrastColor(cardColor);
  const fontSize = TEXT_SIZE_CSS[config.textSize];
  const fontWeight = FONT_WEIGHT_CSS[config.fontWeight];
  const align = priceStyle.align ?? "left";
  const justify =
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
          {product.thumbnail ? (
            <Image
              src={imageSrc || constructUrl(product.thumbnail)}
              alt={product.name}
              fill
              unoptimized
              style={imageStyle}
            />
          ) : null}
        </div>
      </div>
      <div className="p-2" style={{ textAlign: align }}>
        <p
          className="truncate"
          style={{ color: textColor, fontSize, fontWeight }}
        >
          {product.name}
        </p>
        <div
          className="flex items-center gap-2 mt-1"
          style={{ justifyContent: justify }}
        >
          <PriceDisplay
            price={activePrice}
            unit={product.unit}
            showUnit={showUnit}
            style={priceStyle}
            textColor={textColor}
            fontSize={fontSize}
            fontWeight={fontWeight}
          />
          <PriceBadge discount={product.discount} />
        </div>
      </div>
    </div>
  );
}
