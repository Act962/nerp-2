"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ChevronLeft, MapPin, PackageX, ScanBarcode } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { getAnonId } from "../lib/anon-id";
import { useLogScan, useLookupBarcode } from "../hooks/use-shopper-public";
import { FavoriteButton } from "./favorite-button";
import { ProductCoupons } from "./product-coupons";
import { ProductScanCard } from "./product-scan-card";

// Página do produto escaneado: preço/oferta/info + favoritar + cupons. Sem
// "onde está" — quem escaneou já está com o produto na mão (localizar é do
// fluxo de BUSCA). Registra o evento (BARCODE_SCAN ou UNKNOWN_BARCODE).
export function ShopperProduct({
  orgSlug,
  storeId,
  barcode,
}: {
  orgSlug: string;
  storeId: string;
  barcode: string;
}) {
  const base = `/tradegram/${orgSlug}/${storeId}`;
  const lookup = useLookupBarcode(orgSlug, storeId, barcode);
  const logScan = useLogScan();
  const logged = useRef(false);

  useEffect(() => {
    const data = lookup.data;
    if (!data || logged.current) return;
    logged.current = true;
    logScan.mutate({
      orgSlug,
      storeId,
      anonId: getAnonId(),
      kind: data.found ? "BARCODE_SCAN" : "UNKNOWN_BARCODE",
      barcode,
      matched: data.found,
    });
  }, [lookup.data, orgSlug, storeId, barcode, logScan]);

  const product = lookup.data?.found ? lookup.data.product : null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <Link
          href={`${base}/scan`}
          className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Escanear outro
        </Link>
        <div className="flex items-center gap-2">
          {product && (
            <FavoriteButton
              orgSlug={orgSlug}
              storeId={storeId}
              barcode={barcode}
            />
          )}
          <Link
            href={`${base}/mapa`}
            className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
          >
            <MapPin className="size-4" /> Mapa
          </Link>
        </div>
      </header>

      {lookup.isPending ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : !product ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <PackageX className="size-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Produto não encontrado</p>
            <p className="text-muted-foreground text-sm">
              O código <span className="font-mono">{barcode}</span> não está no
              catálogo desta loja.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`${base}/scan`}>
              <ScanBarcode className="size-4" /> Escanear outro
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-5">
          <ProductScanCard product={product} />

          <ProductCoupons
            orgSlug={orgSlug}
            storeId={storeId}
            barcode={barcode}
          />
        </div>
      )}
    </div>
  );
}
