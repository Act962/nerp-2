"use client";

import { useState } from "react";
import { Share2, MessageCircle, Copy, Download, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  useSellerCatalogs,
  useMarkCatalogViewed,
} from "@/features/promotional-catalog/hooks/use-catalog";
import {
  shareImageFile,
  openWhatsAppText,
  copyImageToClipboard,
  downloadDataUrl,
} from "@/features/promotional-catalog/lib/share";

type SellerCatalog = {
  id: string;
  name: string;
  thumbnail: string | null;
  createdAt: Date;
  viewed: boolean;
};

// Aba "Catálogos" do App Vendedor: lista read-only (sem editar) — o vendedor só
// abre e compartilha. Abrir marca como visto (zera o badge).
export function CatalogosTab() {
  const { data: catalogs = [], isLoading } = useSellerCatalogs();
  const markViewed = useMarkCatalogViewed();
  const [active, setActive] = useState<SellerCatalog | null>(null);

  const open = (c: SellerCatalog) => {
    setActive(c);
    if (!c.viewed) markViewed.mutate({ id: c.id });
  };

  const shareNative = async (c: SellerCatalog) => {
    if (!c.thumbnail) return toast.info("Este catálogo ainda não tem prévia.");
    await shareImageFile({
      dataUrl: c.thumbnail,
      filename: `${c.name}.jpg`,
      text: c.name,
    });
  };

  const shareWhatsApp = async (c: SellerCatalog) => {
    if (!c.thumbnail) return toast.info("Este catálogo ainda não tem prévia.");
    const res = await shareImageFile({
      dataUrl: c.thumbnail,
      filename: `${c.name}.jpg`,
      text: c.name,
    });
    if (res === "downloaded") openWhatsAppText(c.name);
  };

  const copy = async (c: SellerCatalog) => {
    if (!c.thumbnail) return toast.info("Este catálogo ainda não tem prévia.");
    const ok = await copyImageToClipboard(c.thumbnail);
    toast[ok ? "success" : "error"](
      ok ? "Imagem copiada" : "Não foi possível copiar",
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (catalogs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
        <Tag className="size-6 opacity-50" />
        Nenhum catálogo disponível ainda.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {catalogs.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => open(c)}
            className="group relative flex flex-col overflow-hidden rounded-lg border text-left transition-shadow hover:shadow-md"
          >
            {!c.viewed && (
              <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
                Novo
              </span>
            )}
            <div className="aspect-[3/4] w-full bg-muted">
              {c.thumbnail ? (
                // biome-ignore lint/performance/noImgElement: miniatura em data URL
                <img
                  src={c.thumbnail}
                  alt={c.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  sem prévia
                </div>
              )}
            </div>
            <span className="truncate px-2 py-1.5 text-xs font-medium">
              {c.name}
            </span>
          </button>
        ))}
      </div>

      <Dialog
        open={!!active}
        onOpenChange={(o) => {
          if (!o) setActive(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{active?.name}</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="flex flex-col gap-3">
              <div className="mx-auto max-h-[55vh] overflow-hidden rounded-md border bg-muted">
                {active.thumbnail ? (
                  // biome-ignore lint/performance/noImgElement: prévia em data URL
                  <img
                    src={active.thumbnail}
                    alt={active.name}
                    className="h-full max-h-[55vh] w-full object-contain"
                  />
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center text-sm text-muted-foreground">
                    Sem prévia
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="gap-1.5"
                  onClick={() => shareWhatsApp(active)}
                >
                  <MessageCircle className="size-4" />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => shareNative(active)}
                >
                  <Share2 className="size-4" />
                  Compartilhar
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => copy(active)}
                >
                  <Copy className="size-4" />
                  Copiar
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  disabled={!active.thumbnail}
                  onClick={() =>
                    active.thumbnail &&
                    downloadDataUrl(active.thumbnail, `${active.name}.jpg`)
                  }
                >
                  <Download className="size-4" />
                  Baixar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
