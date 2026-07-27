"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useIdentifyProduct } from "../hooks/use-shopper-public";
import { getAnonId } from "../lib/anon-id";
import { downscaleImage } from "../lib/downscale-image";

// Identificar produto por FOTO (IA de visão). Achou → vai pra página do produto.
// Não achou → mensagem pedindo pra escanear o código de barras.
export function PhotoIdentify({
  orgSlug,
  storeId,
}: {
  orgSlug: string;
  storeId: string;
}) {
  const router = useRouter();
  const identify = useIdentifyProduct();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const loading = busy || identify.isPending;

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite re-selecionar a mesma foto
    if (!file) return;
    setNotFound(false);
    setBusy(true);
    try {
      const { base64, mimeType } = await downscaleImage(file);
      identify.mutate(
        {
          orgSlug,
          storeId,
          anonId: getAnonId(),
          imageBase64: base64,
          mimeType,
        },
        {
          onSuccess: (result) => {
            if (result.found) {
              router.push(
                `/tradegram/${orgSlug}/${storeId}/produto/${result.barcode}`,
              );
            } else {
              setNotFound(true);
            }
          },
          onError: () => setNotFound(true),
          onSettled: () => setBusy(false),
        },
      );
    } catch {
      setNotFound(true);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFile}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? <Spinner /> : <Sparkles className="size-4" />}
        {loading ? "Identificando…" : "Identificar por foto"}
      </Button>
      {notFound && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800 text-sm">
          Não identificamos o produto. Escaneie o código de barras.
        </p>
      )}
    </div>
  );
}
