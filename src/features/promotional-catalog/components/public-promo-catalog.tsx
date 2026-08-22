"use client";

import { useMemo } from "react";
import { CatalogPreview } from "./catalog-preview";
import { distributePages, finalizeProducts } from "../lib/layout";
import type { CatalogConfig, CatalogProduct } from "../types";
import { isOfferExpired, virtualProductsFromList } from "../types";

interface PublicPromoCatalogProps {
  name: string;
  config: CatalogConfig;
  products: CatalogProduct[];
}

// Render PÚBLICO (read-only) do Catálogo Promocional — sem editor/painéis.
// Reusa `CatalogPreview` página a página, com a mesma distribuição do editor.
export function PublicPromoCatalog({
  name,
  config,
  products,
}: PublicPromoCatalogProps) {
  const finalized = useMemo(
    () =>
      finalizeProducts(config, [
        ...products,
        ...virtualProductsFromList(config.list),
      ]),
    [config, products],
  );
  const pages = useMemo(
    () => distributePages(config, finalized),
    [config, finalized],
  );
  const expired = isOfferExpired(config);

  return (
    <div className="min-h-dvh bg-neutral-200 dark:bg-neutral-900">
      <div className="mx-auto flex w-full max-w-[620px] flex-col gap-6 p-3 sm:p-6">
        <header className="text-center">
          <h1 className="text-lg font-semibold">{name}</h1>
          {expired && (
            <p className="mt-1 text-sm font-medium text-destructive">
              Oferta vencida
            </p>
          )}
        </header>

        {pages.map((pg, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: páginas são estáveis por ordem
            key={i}
            className="overflow-hidden rounded-lg shadow-lg"
          >
            <CatalogPreview
              config={pg.cfg}
              products={pg.products}
              allProducts={finalized}
            />
          </div>
        ))}

        <footer className="pb-6 text-center text-[11px] text-muted-foreground">
          Catálogo gerado no Órbita
        </footer>
      </div>
    </div>
  );
}
