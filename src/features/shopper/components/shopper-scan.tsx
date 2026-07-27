"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, MapPin, ScanBarcode } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isValidBarcode } from "../hooks/use-shopper-public";
import { BarcodeScanner } from "./barcode-scanner";
import { PhotoIdentify } from "./photo-identify";

// Tela de escaneamento (pública, sem login): câmera + campo manual de fallback.
// Ao ler/enviar um código, navega para a página do produto.
export function ShopperScan({
  orgSlug,
  storeId,
}: {
  orgSlug: string;
  storeId: string;
}) {
  const router = useRouter();
  const [manual, setManual] = useState("");
  const base = `/tradegram/${orgSlug}/${storeId}`;

  const go = (code: string) => {
    const clean = code.trim();
    if (!isValidBarcode(clean)) return;
    router.push(`${base}/produto/${clean}`);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <Link
          href={base}
          className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Loja
        </Link>
        <Link
          href={`${base}/mapa`}
          className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <MapPin className="size-4" /> Mapa
        </Link>
      </header>

      <div className="space-y-1">
        <h1 className="flex items-center gap-2 font-semibold text-xl">
          <ScanBarcode className="size-5" /> Escanear produto
        </h1>
        <p className="text-muted-foreground text-sm">
          Aponte a câmera para o código de barras — ou digite o número.
        </p>
      </div>

      <BarcodeScanner onDetect={go} />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          go(manual);
        }}
        className="flex gap-2"
      >
        <Input
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          inputMode="numeric"
          placeholder="Digite o código de barras"
        />
        <Button type="submit" disabled={!isValidBarcode(manual)}>
          Buscar
        </Button>
      </form>

      <div className="flex items-center gap-3 text-muted-foreground text-xs">
        <span className="h-px flex-1 bg-border" /> ou{" "}
        <span className="h-px flex-1 bg-border" />
      </div>

      <PhotoIdentify orgSlug={orgSlug} storeId={storeId} />
    </div>
  );
}
