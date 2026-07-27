"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Copy por variante. `scanner`: QR do cliente final (leitor de código de
// barras). `promotor`: QR que abre a página pública da loja, onde o promotor
// acha o botão de foto para registrar. Ambos dependem de Perfil Público ativo.
const QR_VARIANTS = {
  scanner: {
    title: "QR do cliente (scanner)",
    description:
      "Imprima e coloque na loja. O cliente escaneia e abre o app para ler o código de barras dos produtos e achar as seções no mapa — sem login.",
    path: (slug: string, storeId: string) =>
      `/tradegram/${slug}/${storeId}/scan`,
  },
  promotor: {
    title: "QR do promotor",
    description:
      "O promotor escaneia e abre a página da loja no TradeGram. Lá, o botão de foto leva direto para registrar a execução no PDV.",
    path: (slug: string, storeId: string) => `/tradegram/${slug}/${storeId}`,
  },
} as const;

export type StoreQrVariant = keyof typeof QR_VARIANTS;

// QR da loja para imprimir/colar no PDV. URL resolvida no cliente (funciona em
// dev, staging e prod sem hardcode de domínio).
export function StoreQrDialog({
  open,
  onOpenChange,
  storeId,
  variant = "scanner",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  variant?: StoreQrVariant;
}) {
  const { data: org } = authClient.useActiveOrganization();
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const copy = QR_VARIANTS[variant];
  const url =
    org?.slug && origin ? `${origin}${copy.path(org.slug, storeId)}` : "";

  const copyUrl = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {url ? (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-xl border bg-white p-4">
              <QRCodeSVG value={url} size={208} level="M" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={copyUrl}
            >
              <Copy className="size-4" /> Copiar link
            </Button>
            <p className="break-all text-center text-muted-foreground text-xs">
              {url}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Ative o <strong>Perfil Público</strong> da organização em
            Configurações para o QR funcionar.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
