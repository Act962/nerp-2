import Image from "next/image";
import type React from "react";
import type { CatalogProduct, CatalogConfig } from "../../types";
import { TEXT_SIZE_CSS, FONT_WEIGHT_CSS } from "../../types";
import { PriceBadge, formatPrice } from "./price-badge";
import { getContrastColor } from "@/utils/get-contrast-color";
import { constructUrl } from "@/hooks/use-construct-url";

interface CardListProps {
  product: CatalogProduct;
  config: Pick<CatalogConfig, "showCategory" | "showStock" | "textSize" | "fontWeight">;
  cardStyle?: React.CSSProperties;
  cardColor?: string;
}

export function CardList({ product, config, cardStyle, cardColor = "#ffffff" }: CardListProps) {
  const activePrice = product.promotionalPrice ?? product.salePrice;
  const textColor = getContrastColor(cardColor);
  const fontSize = TEXT_SIZE_CSS[config.textSize];
  const fontWeight = FONT_WEIGHT_CSS[config.fontWeight];

  return (
    <div className="flex items-center gap-4 rounded-lg border p-3 shadow-sm" style={cardStyle}>
      <div className="relative h-20 w-20 shrink-0 rounded bg-muted overflow-hidden">
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
      <div className="flex-1 min-w-0">
        <p className="line-clamp-1" style={{ color: textColor, fontSize, fontWeight }}>
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
          <span style={{ color: textColor, fontSize, fontWeight }}>
            {formatPrice(activePrice)}
          </span>
        </div>
        {product.promotionalPrice && (
          <p className="text-xs opacity-50 line-through" style={{ color: textColor }}>
            {formatPrice(product.salePrice)}
          </p>
        )}
      </div>
    </div>
  );
}
