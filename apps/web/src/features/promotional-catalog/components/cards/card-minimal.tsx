import Image from "next/image";
import type React from "react";
import type { CatalogProduct, CatalogConfig } from "../../types";
import { TEXT_SIZE_CSS, FONT_WEIGHT_CSS } from "../../types";
import { PriceBadge, formatPrice } from "./price-badge";
import { getContrastColor } from "@/utils/get-contrast-color";
import { constructUrl } from "@/hooks/use-construct-url";

interface CardMinimalProps {
  product: CatalogProduct;
  config: Pick<CatalogConfig, "textSize" | "fontWeight">;
  cardStyle?: React.CSSProperties;
  cardColor?: string;
}

export function CardMinimal({ product, config, cardStyle, cardColor = "#ffffff" }: CardMinimalProps) {
  const activePrice = product.promotionalPrice ?? product.salePrice;
  const textColor = getContrastColor(cardColor);
  const fontSize = TEXT_SIZE_CSS[config.textSize];
  const fontWeight = FONT_WEIGHT_CSS[config.fontWeight];

  return (
    <div className="flex flex-col rounded-lg overflow-hidden border shadow-sm" style={cardStyle}>
      <div className="relative aspect-square w-full bg-muted">
        {product.thumbnail ? (
          <Image
            src={constructUrl(product.thumbnail)}
            alt={product.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : null}
      </div>
      <div className="p-2">
        <p className="truncate" style={{ color: textColor, fontSize, fontWeight }}>
          {product.name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span style={{ color: textColor, fontSize, fontWeight }}>
            {formatPrice(activePrice)}
          </span>
          <PriceBadge discount={product.discount} />
        </div>
      </div>
    </div>
  );
}
