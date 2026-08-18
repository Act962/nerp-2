import Image from "next/image";
import type React from "react";
import type { CatalogProduct, CatalogConfig } from "../../types";
import { TEXT_SIZE_CSS, FONT_WEIGHT_CSS } from "../../types";
import { PriceBadge, formatPrice } from "./price-badge";
import { getContrastColor } from "@/utils/get-contrast-color";
import { parseDescriptionText } from "./parse-description";
import { constructUrl } from "@/hooks/use-construct-url";

interface CardStandardProps {
  product: CatalogProduct;
  config: Pick<CatalogConfig, "showDescription" | "showCategory" | "showStock" | "showSku" | "textSize" | "fontWeight">;
  cardStyle?: React.CSSProperties;
  cardColor?: string;
}

export function CardStandard({ product, config, cardStyle, cardColor = "#ffffff" }: CardStandardProps) {
  const activePrice = product.promotionalPrice ?? product.salePrice;
  const textColor = getContrastColor(cardColor);
  const descriptionText = parseDescriptionText(product.description);
  const fontSize = TEXT_SIZE_CSS[config.textSize];
  const fontWeight = FONT_WEIGHT_CSS[config.fontWeight];

  return (
    <div className="flex flex-col rounded-lg border overflow-hidden shadow-sm" style={cardStyle}>
      <div className="relative aspect-square w-full bg-muted">
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
            Sem imagem
          </div>
        )}
        {product.discount && (
          <PriceBadge discount={product.discount} className="absolute top-2 left-2" />
        )}
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="line-clamp-2" style={{ color: textColor, fontSize, fontWeight }}>
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
          <p className="text-xs opacity-60 line-clamp-2" style={{ color: textColor }}>
            {descriptionText}
          </p>
        )}
        <div className="mt-auto pt-2">
          <p style={{ color: textColor, fontSize, fontWeight }}>
            {formatPrice(activePrice)}
          </p>
          {product.promotionalPrice && (
            <>
              <p className="text-xs opacity-50 line-through" style={{ color: textColor }}>
                {formatPrice(product.salePrice)}
              </p>
              {product.savings && (
                <p className="text-xs text-green-600 font-medium">
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
