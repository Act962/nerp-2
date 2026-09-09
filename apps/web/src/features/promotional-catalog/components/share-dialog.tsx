"use client";

import { useEffect, useState } from "react";
import {
  Share2,
  MessageCircle,
  Instagram,
  Copy,
  Download,
  FileText,
  Printer,
  Loader2,
} from "lucide-react";
import { Link2, Link2Off } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  useEnableCatalogShare,
  useDisableCatalogShare,
} from "../hooks/use-catalog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  shareImageFile,
  openWhatsAppText,
  copyImageToClipboard,
} from "../lib/share";
import {
  EXPORT_PRESETS,
  type ExportQuality,
  formatMB,
  presetDpi,
} from "../hooks/use-export";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogId: string;
  catalogName: string;
  totalPages: number;
  // Nomes das páginas (para o seletor "qual página compartilhar").
  pageNames: string[];
  // Página em foco ao abrir o compartilhar (default do seletor).
  initialPage: number;
  onExportPng: () => void;
  onExportPdf: () => void;
  // Mede o tamanho provável do PDF por amostragem, sob demanda.
  onEstimatePdf: () => Promise<number>;
  quality: ExportQuality;
  onQualityChange: (quality: ExportQuality) => void;
  // Baixa APENAS a página selecionada (.png / .pdf).
  onExportPagePng: (index: number) => void;
  onExportPagePdf: (index: number) => void;
  // Imprime a página selecionada (abre o diálogo de impressão do navegador).
  onPrintPage: (index: number) => void;
  // Captura UMA página em PNG (data URL, resolução cheia) p/ copiar/compartilhar.
  capturePage: (index: number) => Promise<string>;
}

export function ShareDialog({
  open,
  onOpenChange,
  catalogId,
  catalogName,
  totalPages,
  pageNames,
  initialPage,
  onExportPng,
  onExportPdf,
  onEstimatePdf,
  quality,
  onQualityChange,
  onExportPagePng,
  onExportPagePdf,
  onPrintPage,
  capturePage,
}: ShareDialogProps) {
  const [busy, setBusy] = useState<string | null>(null);
  // Tamanho estimado do PDF: só depois que o usuário pede, porque a medição
  // monta e rasteriza 3 páginas de verdade (2-4 s). Zera ao trocar o preset.
  const [estimativa, setEstimativa] = useState<number | null>(null);
  const [estimando, setEstimando] = useState(false);
  // Link público do catálogo.
  const [link, setLink] = useState<string | null>(null);
  const enableShare = useEnableCatalogShare();
  const disableShare = useDisableCatalogShare();

  const createLink = () => {
    enableShare.mutate(
      { id: catalogId },
      {
        onSuccess: ({ shareToken }) => {
          setLink(`${window.location.origin}/promocao/${shareToken}`);
        },
        onError: () => toast.error("Não consegui criar o link."),
      },
    );
  };
  const removeLink = () => {
    disableShare.mutate(
      { id: catalogId },
      {
        onSuccess: () => {
          setLink(null);
          toast.info("Link desativado.");
        },
        onError: () => toast.error("Não consegui desativar o link."),
      },
    );
  };
  // Qual página compartilhar (imagem). Começa na página em foco.
  const [pageIndex, setPageIndex] = useState(initialPage);
  // Ao abrir, sincroniza com a página em foco no editor.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só ao (re)abrir
  useEffect(() => {
    if (open) setPageIndex(initialPage);
  }, [open]);

  const safeIndex = Math.min(
    Math.max(0, pageIndex),
    Math.max(0, totalPages - 1),
  );

  const withImage = async (
    key: string,
    fn: (dataUrl: string) => Promise<void> | void,
  ) => {
    setBusy(key);
    try {
      const dataUrl = await capturePage(safeIndex);
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

  const pageLabel = pageNames[safeIndex] ?? `Página ${safeIndex + 1}`;
  const filename =
    totalPages > 1 ? `${catalogName} - ${pageLabel}.png` : `${catalogName}.png`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar</DialogTitle>
        </DialogHeader>

        {/* Escolher qual página compartilhar (imagem) — estilo Canva */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-xs text-muted-foreground">
              Página
            </Label>
            <Select
              value={String(safeIndex)}
              onValueChange={(v) => setPageIndex(Number(v))}
            >
              <SelectTrigger className="h-8 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: totalPages }, (_, i) => (
                  <SelectItem key={i} value={String(i)} className="text-xs">
                    {pageNames[i] ?? `Página ${i + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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

        {/* Link público do catálogo */}
        <div className="flex flex-col gap-2">
          {!link ? (
            <Button
              variant="outline"
              className="justify-start gap-2"
              disabled={enableShare.isPending}
              onClick={createLink}
            >
              {enableShare.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Criar link do catálogo
            </Button>
          ) : (
            <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-2">
              <div className="flex items-center gap-2">
                <Input readOnly value={link} className="h-8 text-xs" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(link);
                    toast.success("Link copiado.");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={() => openWhatsAppText(`${catalogName}\n${link}`)}
                >
                  <MessageCircle className="h-4 w-4" />
                  Enviar link no WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-destructive"
                  disabled={disableShare.isPending}
                  onClick={removeLink}
                >
                  <Link2Off className="h-4 w-4" />
                  Desativar
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Qualidade do download. O PDF antigo saía em PNG sem perda a 2400 px
            e passava de centenas de MB num catálogo grande; aqui o usuário
            escolhe onde ficar entre nitidez e peso. */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Qualidade do PDF</Label>
            <Select
              value={quality}
              onValueChange={(v) => {
                onQualityChange(v as ExportQuality);
                setEstimativa(null);
              }}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EXPORT_PRESETS) as ExportQuality[]).map((k) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    {EXPORT_PRESETS[k].label} — {EXPORT_PRESETS[k].targetWidth}
                    px · {presetDpi(k)} DPI
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {totalPages > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 self-start px-2 text-muted-foreground text-xs"
              disabled={estimando}
              onClick={async () => {
                setEstimando(true);
                try {
                  setEstimativa(await onEstimatePdf());
                } catch (err) {
                  console.error("Erro ao estimar o tamanho do PDF:", err);
                  toast.error("Não foi possível estimar o tamanho.");
                } finally {
                  setEstimando(false);
                }
              }}
            >
              {estimando && <Loader2 className="mr-1 size-3 animate-spin" />}
              {estimativa !== null
                ? `≈ ${formatMB(estimativa)} (estimativa)`
                : "Estimar tamanho"}
            </Button>
          )}
        </div>

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
          <Button
            variant="outline"
            className="justify-start gap-2"
            onClick={() => onPrintPage(safeIndex)}
          >
            <Printer className="h-4 w-4" />
            Imprimir página{totalPages > 1 ? " selecionada" : ""}
          </Button>
          {totalPages > 1 && (
            <>
              <div className="h-px bg-border/60" />
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => onExportPagePng(safeIndex)}
              >
                <Download className="h-4 w-4" />
                Baixar apenas a página selecionada (.PNG)
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => onExportPagePdf(safeIndex)}
              >
                <FileText className="h-4 w-4" />
                Baixar .pdf da página selecionada
              </Button>
            </>
          )}
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
