"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { PhotoCaptureInput } from "@/features/pdv-photos/components/photo-capture-input";
import { MediaTypeSelect } from "@/features/trade-catalog/components/media-type-select";
import {
  useApprovedCountByStore,
  useApprovedForImport,
} from "@/features/promotor/hooks/use-promotor";
import { useStores } from "@/features/stores/hooks/use-stores";
import { constructUrl } from "@/hooks/use-construct-url";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { compressImage } from "@/lib/compress-image";
import { uploadToR2 } from "@/lib/upload-to-r2";
import {
  Check,
  ChevronsUpDown,
  Eye,
  Store as StoreIcon,
  ThumbsUp,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

// Foto escolhida: id = pdvPhotoId (null se veio de upload direto), photoKey = a
// chave no R2. Passar o id deixa o V2 resolver fotos de QUALQUER loja.
export interface PickedPhoto {
  id: string | null;
  photoKey: string;
}

interface ImportPhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Indústria do book — filtra as fotos aprovadas (sem seletor de indústria).
  defaultSupplierId?: string | null;
  // Loja da página — pré-selecionada por padrão (dá pra trocar / "Todas").
  defaultStoreId?: string | null;
  defaultStoreName?: string | null;
  // Book atual: mostra "Já usada - pág. N" nas fotos já no book.
  bookId?: string;
  onPick: (photo: PickedPhoto) => void;
}

export function ImportPhotoDialog({
  open,
  onOpenChange,
  defaultSupplierId,
  defaultStoreId,
  defaultStoreName,
  bookId,
  onPick,
}: ImportPhotoDialogProps) {
  // null = "Todas as lojas".
  const [storeId, setStoreId] = useState<string | null>(defaultStoreId ?? null);
  const [storeName, setStoreName] = useState<string | null>(
    defaultStoreName ?? null,
  );
  const [storeOpen, setStoreOpen] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const [mediaFilter, setMediaFilter] = useState<string | null>(null);
  const [likedOnly, setLikedOnly] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Foto aberta no preview ampliado (clicando no ícone "ver foto").
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  const { stores } = useStores({
    search: useDebouncedValue(storeSearch) || undefined,
    pageSize: 30,
  });
  // Nº de fotos aprovadas por loja para a indústria do book (mostrado no
  // dropdown ao lado de cada loja).
  const { countByStore } = useApprovedCountByStore(
    defaultSupplierId ?? undefined,
    open,
  );
  const totalPhotos = [...countByStore.values()].reduce((a, b) => a + b, 0);

  const { photos, isLoading } = useApprovedForImport(
    storeId ?? undefined,
    defaultSupplierId ?? undefined,
    open,
    bookId,
    likedOnly,
  );

  const visible = useMemo(
    () =>
      mediaFilter
        ? photos.filter((p) => p.mediaTypeId === mediaFilter)
        : photos,
    [photos, mediaFilter],
  );

  const pick = (photo: PickedPhoto) => {
    onPick(photo);
    onOpenChange(false);
  };

  const uploadDirect = async (file: File) => {
    setUploading(true);
    try {
      const key = await uploadToR2(await compressImage(file), true);
      pick({ id: null, photoKey: key });
    } catch {
      toast.error("Não foi possível enviar a foto");
    } finally {
      setUploading(false);
    }
  };

  const selectStore = (id: string | null, name: string | null) => {
    setStoreId(id);
    setStoreName(name);
    setStoreOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[95vh] max-h-[95vh] w-[95vw] max-w-[95vw] flex-col overflow-hidden sm:max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>Adicionar foto</DialogTitle>
          <DialogDescription>
            Escolha uma foto aprovada do promotor — filtre por loja/cliente e
            tipo de mídia. Passe o mouse numa foto para vê-la ampliada.
          </DialogDescription>
        </DialogHeader>

        {/* Filtros: loja (com busca + "Todas") e tipo de mídia. */}
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={storeOpen} onOpenChange={setStoreOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-64 justify-between gap-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <StoreIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {storeId ? (storeName ?? "Loja") : "Todas as lojas"}
                  </span>
                </span>
                <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
              <Command shouldFilter={false}>
                <CommandInput
                  value={storeSearch}
                  onValueChange={setStoreSearch}
                  placeholder="Buscar loja/cliente…"
                />
                <CommandList>
                  <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                    Nenhuma loja.
                  </CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="__all__"
                      onSelect={() => selectStore(null, null)}
                      className="gap-2"
                    >
                      <Check
                        className={`size-4 ${storeId === null ? "opacity-100" : "opacity-0"}`}
                      />
                      <span className="flex-1 truncate">Todas as lojas</span>
                      <span className="shrink-0 rounded bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                        {totalPhotos}
                      </span>
                    </CommandItem>
                    {stores.map((store) => {
                      const count = countByStore.get(store.id) ?? 0;
                      return (
                        <CommandItem
                          key={store.id}
                          value={store.id}
                          onSelect={() => selectStore(store.id, store.name)}
                          className="gap-2"
                        >
                          <Check
                            className={`size-4 ${storeId === store.id ? "opacity-100" : "opacity-0"}`}
                          />
                          <span className="flex-1 truncate">{store.name}</span>
                          <span
                            className={`shrink-0 rounded px-1.5 text-xs tabular-nums ${
                              count > 0
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {count}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <MediaTypeSelect
            value={mediaFilter}
            onChange={setMediaFilter}
            placeholder="Filtrar por mídia"
          />
          <Button
            type="button"
            variant={likedOnly ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => setLikedOnly((v) => !v)}
            title="Mostrar só as fotos marcadas com “Gostei”"
            aria-pressed={likedOnly}
          >
            <ThumbsUp className="size-4" />
            Gostei
          </Button>
        </div>

        {/* Grade masonry: cada foto inteira, na orientação em que foi salva. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : visible.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhuma foto aprovada para este filtro.
            </p>
          ) : (
            <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
              {visible.map((photo) => {
                const isPreviewing = previewKey === photo.photoKey;
                return (
                  <div
                    key={photo.id}
                    className="relative mb-3 break-inside-avoid"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        photo.photoKey &&
                        pick({ id: photo.id, photoKey: photo.photoKey })
                      }
                      className="block w-full overflow-hidden rounded-md border bg-muted transition-shadow hover:ring-2 hover:ring-primary"
                    >
                      {/* biome-ignore lint/performance/noImgElement: thumbnail de key do R2 */}
                      <img
                        src={constructUrl(photo.photoKey)}
                        alt=""
                        loading="lazy"
                        className="block h-auto w-full"
                      />
                      {photo.usedInBook && (
                        <span className="absolute inset-x-0 bottom-0 bg-amber-500/90 py-0.5 text-center text-[11px] font-semibold text-white">
                          {photo.usedInPage != null
                            ? `Já usada - pág. ${photo.usedInPage}`
                            : "Já usada"}
                        </span>
                      )}
                    </button>
                    {/* Ver foto: abre/fecha o preview ampliado (muda de cor
                        quando ativo). Substitui o hover. */}
                    <button
                      type="button"
                      title="Ver foto"
                      aria-label="Ver foto"
                      aria-pressed={isPreviewing}
                      onClick={() =>
                        setPreviewKey((cur) =>
                          cur === photo.photoKey ? null : photo.photoKey,
                        )
                      }
                      className={`absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full shadow-sm transition-colors ${
                        isPreviewing
                          ? "bg-primary text-primary-foreground"
                          : "bg-black/55 text-white hover:bg-black/70"
                      }`}
                    >
                      <Eye className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upload direto — mantém a liberdade de adicionar foto nova. */}
        <div className="shrink-0 border-t pt-3">
          <p className="mb-2 text-sm font-medium">
            Ou tire/envie uma foto agora
          </p>
          <PhotoCaptureInput
            onFiles={(files) => files[0] && uploadDirect(files[0])}
            isUploading={uploading}
          />
        </div>
      </DialogContent>

      {/* Preview ampliado (aberto pelo ícone "ver foto"). Fecha no X ou no
          fundo. */}
      {open &&
        previewKey &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6">
            {/* Fundo clicável pra fechar. */}
            <button
              type="button"
              aria-label="Fechar visualização"
              onClick={() => setPreviewKey(null)}
              className="absolute inset-0 cursor-default"
            />
            {/* biome-ignore lint/performance/noImgElement: preview ampliado da key do R2 */}
            <img
              src={constructUrl(previewKey)}
              alt=""
              className="pointer-events-none relative max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />
            <button
              type="button"
              aria-label="Fechar"
              title="Fechar"
              onClick={() => setPreviewKey(null)}
              className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
            >
              <X className="size-5" />
            </button>
          </div>,
          document.body,
        )}
    </Dialog>
  );
}
