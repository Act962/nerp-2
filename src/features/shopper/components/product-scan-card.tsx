"use client";

import { Badge } from "@/components/ui/badge";
import { constructUrl } from "@/hooks/use-construct-url";
import { Package } from "lucide-react";

export interface ScannedProduct {
  name: string;
  thumbnail: string | null;
  images: string[];
  brandName: string | null;
  categoryName: string | null;
  salePrice: number;
  promotionalPrice: number | null;
  discount: number | null;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ProductScanCard({ product }: { product: ScannedProduct }) {
  const imageKey = product.thumbnail || product.images[0] || null;
  const hasPromo = product.promotionalPrice !== null;
  const current = hasPromo
    ? (product.promotionalPrice as number)
    : product.salePrice;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
        {imageKey ? (
          // biome-ignore lint/performance/noImgElement: imagem por key do R2
          <img
            src={constructUrl(imageKey)}
            alt={product.name}
            className="max-h-56 w-full object-contain"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center text-muted-foreground">
            <Package className="size-10" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        {product.brandName && (
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            {product.brandName}
          </p>
        )}
        <h1 className="font-semibold text-lg leading-tight">{product.name}</h1>
        {product.categoryName && (
          <p className="text-muted-foreground text-sm">
            {product.categoryName}
          </p>
        )}
      </div>

      <div className="flex items-end gap-3">
        <span className="font-bold text-3xl tabular-nums">
          {formatBRL(current)}
        </span>
        {hasPromo && (
          <>
            <span className="text-muted-foreground line-through">
              {formatBRL(product.salePrice)}
            </span>
            {product.discount ? (
              <Badge className="border-emerald-300 bg-emerald-50 text-emerald-700">
                -{product.discount}%
              </Badge>
            ) : null}
          </>
        )}
      </div>
      {hasPromo && (
        <p className="font-medium text-emerald-700 text-sm">Em oferta 🎉</p>
      )}
    </div>
  );
}
