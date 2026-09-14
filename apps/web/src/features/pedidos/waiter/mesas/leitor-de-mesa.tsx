"use client";

import { Button } from "@/components/ui/button";
import {
  BarcodeScanner,
  QR_FORMATS,
} from "@/features/shopper/components/barcode-scanner";
import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { useResolverQrDaMesa } from "../hooks/use-mesas";

/**
 * Câmera apontada para o adesivo da mesa.
 *
 * O QR diz a MESA. Quem atende continua sendo quem está logado no aparelho: se
 * o nome viesse do papel, qualquer um assinaria pedido no nome do colega.
 */
export function LeitorDeMesa({
  orgSlug,
  aoAbrirMesa,
  aoFechar,
}: {
  orgSlug: string;
  aoAbrirMesa: (mesaId: string) => void;
  aoFechar: () => void;
}) {
  const resolver = useResolverQrDaMesa();
  const [lendo, setLendo] = useState(false);

  const aoDetectar = (valor: string) => {
    if (lendo) return;
    setLendo(true);

    // O adesivo pode ter sido impresso como URL completa; o que interessa é o
    // último trecho do caminho.
    const token = valor.trim().split("/").filter(Boolean).pop() ?? valor.trim();

    resolver.mutate(
      { orgSlug, qrToken: token },
      {
        onSuccess: ({ id }) => aoAbrirMesa(id),
        onError: () => setLendo(false),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-white">
      <div className="flex items-center justify-between p-4">
        <p className="text-lg font-semibold">Ler QR da mesa</p>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 text-white hover:bg-white/10"
          onClick={aoFechar}
          aria-label="Fechar leitor"
        >
          <X className="size-6" />
        </Button>
      </div>

      <div className="relative min-h-0 flex-1">
        <BarcodeScanner onDetect={aoDetectar} formats={QR_FORMATS} fill />
        {lendo && (
          <div className="absolute inset-0 flex items-center justify-center gap-3 bg-zinc-950/80">
            <Loader2 className="size-6 animate-spin" />
            Abrindo a mesa…
          </div>
        )}
      </div>

      <p className="p-5 text-center text-sm text-white/70">
        Aponte para o adesivo da mesa. O número entra sozinho; quem atende é
        você.
      </p>
    </div>
  );
}
