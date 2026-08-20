"use client";

import { useState } from "react";
import {
  Share2,
  MessageCircle,
  Instagram,
  Copy,
  Download,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  shareImageFile,
  openWhatsAppText,
  copyImageToClipboard,
} from "../lib/share";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogName: string;
  totalPages: number;
  onExportPng: () => void;
  onExportPdf: () => void;
  // Captura a página atual em PNG (data URL, resolução cheia) para copiar/compartilhar.
  capturePng: () => Promise<string>;
}

export function ShareDialog({
  open,
  onOpenChange,
  catalogName,
  totalPages,
  onExportPng,
  onExportPdf,
  capturePng,
}: ShareDialogProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const withImage = async (
    key: string,
    fn: (dataUrl: string) => Promise<void> | void,
  ) => {
    setBusy(key);
    try {
      const dataUrl = await capturePng();
      if (!dataUrl) {
        toast.error("Não consegui gerar a imagem. Tente novamente.");
        return;
      }
      await fn(dataUrl);
    } catch {
      toast.error("Erro ao gerar a imagem.");
    } finally {
      setBusy(null);
    }
  };

  const filename = `${catalogName}.png`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="justify-start gap-2"
            disabled={busy !== null}
            onClick={() =>
              withImage("share", async (d) => {
                const r = await shareImageFile({
                  dataUrl: d,
                  filename,
                  text: catalogName,
                });
                if (r === "downloaded")
                  toast.info("Imagem baixada — compartilhe pelo app.");
              })
            }
          >
            {busy === "share" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            Compartilhar
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-2"
            disabled={busy !== null}
            onClick={() =>
              withImage("wa", async (d) => {
                const r = await shareImageFile({
                  dataUrl: d,
                  filename,
                  text: catalogName,
                });
                if (r === "downloaded") openWhatsAppText(catalogName);
              })
            }
          >
            {busy === "wa" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            WhatsApp
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-2"
            disabled={busy !== null}
            onClick={() =>
              withImage("ig", async (d) => {
                const r = await shareImageFile({ dataUrl: d, filename });
                if (r === "downloaded")
                  toast.info("Imagem baixada — poste no app do Instagram.");
              })
            }
          >
            {busy === "ig" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Instagram className="h-4 w-4" />
            )}
            Instagram
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-2"
            disabled={busy !== null}
            onClick={() =>
              withImage("copy", async (d) => {
                const ok = await copyImageToClipboard(d);
                if (ok) toast.success("Imagem copiada.");
                else toast.error("Este navegador não permite copiar a imagem.");
              })
            }
          >
            {busy === "copy" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Copiar imagem
          </Button>
        </div>

        <div className="h-px bg-border" />

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="justify-start gap-2"
            onClick={onExportPng}
          >
            <Download className="h-4 w-4" />
            {totalPages > 1
              ? "Baixar páginas (PNG em .zip)"
              : "Baixar imagem (PNG)"}
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-2"
            onClick={onExportPdf}
          >
            <FileText className="h-4 w-4" />
            Baixar PDF{totalPages > 1 ? " (todas as páginas)" : ""}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Compartilhar, WhatsApp e Instagram usam a bandeja de compartilhamento
          do celular. No computador, a imagem é baixada (e o WhatsApp Web abre)
          — é a mesma limitação do Canva: não há como postar direto na rede pela
          web.
        </p>
      </DialogContent>
    </Dialog>
  );
}
