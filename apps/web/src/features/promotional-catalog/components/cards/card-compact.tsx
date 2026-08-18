import Image from "next/image";
import type React from "react";
import type { CatalogProduct, CatalogConfig } from "../../types";
import { TEXT_SIZE_CSS, FONT_WEIGHT_CSS } from "../../types";
import { PriceBadge, formatPrice } from "./price-badge";
import { getContrastColor } from "@/utils/get-contrast-color";
import { constructUrl } from "@/hooks/use-construct-url";

interface CardCompactProps {
  product: CatalogProduct;
  config: Pick<CatalogConfig, "textSize" | "fontWeight">;
  cardStyle?: React.CSSProperties;
  cardColor?: string;
}

export function CardCompact({ product, config, cardStyle, cardColor = "#ffffff" }: CardCompactProps) {
  const activePrice = product.promotionalPrice ?? product.salePrice;
  const textColor = getContrastColor(cardColor);
  const fontSize = TEXT_SIZE_CSS[config.textSize];
  const fontWeight = FONT_WEIGHT_CSS[config.fontWeight];

  return (
    <div className="flex items-center gap-3 rounded-lg border p-2 shadow-sm" style={cardStyle}>
      <div className="relative h-16 w-16 shrink-0 rounded bg-muted overflow-hidden">
        {product.thumbnail ? (
          <Image
            src={constructUrl(product.thumbnail)}
            alt={product.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
            —
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate" style={{ color: textColor, fontSize, fontWeight }}>
          {product.name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <PriceBadge discount={product.discount} />
          <span style={{ color: textColor, fontSize, fontWeight }}>
            {formatPrice(activePrice)}
          </span>
        </div>
      </div>
    </div>
  );
}
