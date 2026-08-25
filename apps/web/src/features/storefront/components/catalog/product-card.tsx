"use client";

import { useEffect, useState } from "react";
import type { ProductCatalog } from "../../types/product";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { currencyFormatter } from "@/utils/currency-formatter";
import Image from "next/image";
import { useConstructUrl } from "@/hooks/use-construct-url";
import placeholder from "@/assets/background-default-image.svg";
import Link from "next/link";
import { useCart } from "@/hooks/use-cart";
import { useCatalogHref } from "@/features/storefront/lib/catalog-base";
import { ButtonSale } from "../button-sale";
import { SafeContent } from "@/components/rich-text/safe-content";
import { type JSONContent, generateText } from "@tiptap/react";
import { baseExtensions } from "@/components/rich-text/extensions";

function parseDescription(raw: string | null | undefined): {
  plainText: string;
  json: JSONContent | null;
} {
  if (!raw) return { plainText: "", json: null };
  try {
    const json: JSONContent = JSON.parse(raw);
    const plainText = generateText(json, baseExtensions);
    return { plainText, json };
  } catch {
    return { plainText: raw, json: null };
  }
}

interface ProductCardProps extends ProductCatalog {
  allowsOrders?: boolean;
  subdomain: string;
  isDisponile: boolean;
  promotionalPrice: number | null;
}

export function ProductCard({
  id,
  name,
  description,
  salePrice,
  promotionalPrice,
  thumbnail,
  allowsOrders,
  slug,
  subdomain,
  isDisponile,
}: ProductCardProps) {
  const { toggleProduct, isProductInCart } = useCart(subdomain);
  const [isMounted, setIsMounted] = useState(false);
  const parsedDescription = parseDescription(description);
  const productHref = useCatalogHref(`/${slug}`);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const showAsInCart = isMounted && isProductInCart(id);

  const imageSrc =
    thumbnail && thumbnail.trim() !== ""
      ? useConstructUrl(thumbnail)
      : placeholder;

  return (
    <div
      id={id}
      className="flex flex-col items-center 
      gap-y-3 pb-5 rounded-sm bg-accent-foreground/5 shadow-sm 
      transition-shadow overflow-hidden animate-fade-in
      hover:shadow-md hover:shadow-elegant"
    >
      <div className="aspect-square overflow-hidden w-full relative h-45">
        <Link href={productHref}>
          <Image
            className="object-cover transition-transform rounded-sm cursor-pointer"
            src={imageSrc}
            alt={name}
            fill
          />
        </Link>
      </div>
      <div className="flex flex-col w-full px-5">
        <Tooltip>
          <TooltipTrigger asChild>
            <h2 className="text-sm font-semibold line-clamp-1 min-h-7.5 truncate">
              {name}
            </h2>
          </TooltipTrigger>
          <TooltipContent>
            <p>{name}</p>
          </TooltipContent>
        </Tooltip>
        <div className="min-h-8">
          {parsedDescription.plainText ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight mb-1 cursor-default">
                  {parsedDescription.plainText}
                </p>
              </TooltipTrigger>
              <TooltipContent className="max-w-60 bg-popover text-popover-foreground border border-border shadow-md">
                {parsedDescription.json ? (
                  <SafeContent
                    content={parsedDescription.json}
                    className="prose prose-sm prose-p:my-0.5 prose-ul:my-0.5 prose-ol:my-0.5 text-xs max-w-none"
                  />
                ) : (
                  <p>{parsedDescription.plainText}</p>
                )}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href={productHref}
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors leading-tight"
            >
              ver detalhes
            </Link>
          )}
        </div>
        {promotionalPrice ? (
          <div className="flex items-center gap-x-2">
            <p className="text-lg font-bold">
              R${currencyFormatter(promotionalPrice)}
            </p>
            <p className="text-sm font-semibold line-through">
              R${currencyFormatter(salePrice)}
            </p>
          </div>
        ) : (
          <p className="text-lg font-bold">R${currencyFormatter(salePrice)}</p>
        )}
      </div>
      {allowsOrders && (
        <div className="flex items-center gap-x-2 w-full px-5">
          <ButtonSale
            className="w-full"
            data={{
              productIsDisponile: isDisponile,
              showAsInCart: showAsInCart,
            }}
            onClick={() => toggleProduct(id, "1")}
          />
        </div>
      )}
    </div>
  );
}
