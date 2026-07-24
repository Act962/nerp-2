"use client";

import {
  NO_PAGE_TEMPLATE,
  PageTemplatePicker,
} from "../templates/page-template-picker";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { PhotoCaptureInput } from "@/features/pdv-photos/components/photo-capture-input";
import { useStores, useCreateStore } from "@/features/stores/hooks/use-stores";
import { useMediaTypes } from "@/features/trade-catalog/hooks/use-trade-catalog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useIsMobile } from "@/hooks/use-mobile";
import { constructUrl } from "@/hooks/use-construct-url";
import { compressImage } from "@/lib/compress-image";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, Store as StoreIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MAX_PHOTOS } from "./book-page-photo-grid";

interface AddPageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: {
    storeId: string;
    mediaTypeId?: string;
    photoKeys: string[];
    pageTemplateId?: string | null;
  }) => Promise<void> | void;
  onDuplicate: (itemId: string) => Promise<void> | void;
  isSaving: boolean;
  supplierId?: string | null;
  // Páginas já no book, para o atalho "Duplicar página".
  existingPages: { id: string; storeName: string }[];
}

type Step = 1 | 2 | 3;
// "choose" = tela inicial de atalhos; "full" entra no fluxo PDV→mídia→foto.
type Mode = "choose" | "full" | "duplicate" | "template";

export function AddPageSheet({
  open,
  onOpenChange,
  onConfirm,
  onDuplicate,
  isSaving,
  supplierId,
  existingPages,
}: AddPageSheetProps) {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<Mode>("choose");
  const [step, setStep] = useState<Step>(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { stores, isLoading: isLoadingStores } = useStores(
    debouncedSearch || undefined,
  );
  const { mediaTypes, isLoading: isLoadingMediaTypes } = useMediaTypes();
  const createStore = useCreateStore();

  const [pageTemplateId, setPageTemplateId] =
    useState<string>(NO_PAGE_TEMPLATE);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [mediaTypeId, setMediaTypeId] = useState<string | null>(null);
  const [photoKeys, setPhotoKeys] = useState<string[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);

  useEffect(() => {
    if (open) return;
    setMode("choose");
    setStep(1);
    setSearch("");
    setStoreId(null);
    setStoreName("");
    setMediaTypeId(null);
    setPageTemplateId(NO_PAGE_TEMPLATE);
    setPhotoKeys([]);
    setUploadingCount(0);
  }, [open]);

  const goToMediaStep = () => {
    // Catálogo de mídia vazio não pode travar o promotor em campo.
    setStep(mediaTypes.length === 0 && !isLoadingMediaTypes ? 3 : 2);
  };

  const selectStore = (id: string, name: string) => {
    setStoreId(id);
    setStoreName(name);
    goToMediaStep();
  };

  const handleCreateStore = () => {
    const name = search.trim();
    if (!name) return;
    createStore.mutate(
      { name },
      { onSuccess: (result) => selectStore(result.id, result.name) },
    );
  };

  const handleFiles = async (files: File[]) => {
    const remaining = Math.max(MAX_PHOTOS - photoKeys.length, 0);
    if (remaining === 0) return;
    const toUpload = files.slice(0, remaining);
    setUploadingCount((count) => count + toUpload.length);
    try {
      // allSettled e não all: uma falha no meio do lote não pode descartar as
      // fotos que já subiram — é o caso comum no 4G dentro do supermercado.
      const results = await Promise.allSettled(
        toUpload.map(async (file) =>
          uploadToR2(await compressImage(file), true),
        ),
      );

      const keys = results
        .filter(
          (result): result is PromiseFulfilledResult<string> =>
            result.status === "fulfilled",
        )
        .map((result) => result.value);

      if (keys.length > 0) {
        setPhotoKeys((prev) => [...prev, ...keys].slice(0, MAX_PHOTOS));
      }

      const failed = results.length - keys.length;
      if (failed > 0) {
        toast.error(
          keys.length > 0
            ? `${failed} de ${results.length} fotos não subiram. As demais foram salvas.`
            : "Falha ao enviar fotos",
        );
      }
    } finally {
      setUploadingCount((count) => Math.max(0, count - toUpload.length));
    }
  };

  const handleSave = async () => {
    if (!storeId) return;
    try {
      await onConfirm({
        storeId,
        mediaTypeId: mediaTypeId ?? undefined,
        photoKeys,
        pageTemplateId:
          pageTemplateId === NO_PAGE_TEMPLATE ? null : pageTemplateId,
      });
    } catch {
      // O toast já vem do hook da mutation. O catch existe pra a rejeição não
      // escapar de um onClick async como unhandled rejection — e pra o sheet
      // continuar aberto com o que o promotor já preencheu, pronto pra retry.
      return;
    }
    onOpenChange(false);
  };

  const handleDuplicate = async (itemId: string) => {
    try {
      await onDuplicate(itemId);
    } catch {
      return;
    }
    onOpenChange(false);
  };

  // Página só com padrão: sem escolher PDV agora. Usa a primeira loja como
  // marcador (o promotor ajusta os dados no card depois).
  const handleTemplateOnly = async () => {
    const store = stores[0];
    if (!store) {
      toast.error("Cadastre uma loja antes de criar uma página em branco");
      return;
    }
    try {
      await onConfirm({
        storeId: store.id,
        photoKeys: [],
        pageTemplateId:
          pageTemplateId === NO_PAGE_TEMPLATE ? null : pageTemplateId,
      });
    } catch {
      return;
    }
    onOpenChange(false);
  };

  const title =
    mode === "choose"
      ? "Adicionar página"
      : mode === "duplicate"
        ? "Duplicar página"
        : mode === "template"
          ? "Aplicar padrão de página"
          : step === 1
            ? "Escolher o PDV"
            : step === 2
              ? "Tipo de mídia"
              : "Fotos";
  const description =
    mode === "choose"
      ? "Escolha como quer criar a página."
      : mode === "duplicate"
        ? "Copia uma página existente (dados, fotos e layout) numa nova."
        : mode === "template"
          ? "A página nasce com o padrão escolhido; preencha os dados do PDV depois no card."
          : step === 1
            ? "Busque a loja que você está visitando. Se ela ainda não estiver cadastrada, dá pra criar na hora."
            : step === 2
              ? `${storeName} — o que você está fotografando?`
              : `${storeName} — tire as fotos do espaço.`;

  const body = (
    <div className="space-y-4">
      {mode === "choose" && (
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => setMode("full")}
            className="flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors hover:border-primary"
          >
            <span className="text-sm font-semibold">Nova do zero</span>
            <span className="text-xs text-muted-foreground">
              Escolher PDV → tipo de mídia → tirar as fotos.
            </span>
          </button>
          <button
            type="button"
            disabled={existingPages.length === 0}
            onClick={() => setMode("duplicate")}
            className="flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors hover:border-primary disabled:opacity-50"
          >
            <span className="text-sm font-semibold">Duplicar página</span>
            <span className="text-xs text-muted-foreground">
              {existingPages.length === 0
                ? "Nenhuma página no book ainda."
                : "Copiar uma página existente com tudo dentro."}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("template")}
            className="flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors hover:border-primary"
          >
            <span className="text-sm font-semibold">
              Aplicar padrão de página
            </span>
            <span className="text-xs text-muted-foreground">
              Criar já com um padrão salvo, sem preencher o PDV agora.
            </span>
          </button>
        </div>
      )}

      {mode === "duplicate" && (
        <Command className="rounded-md border">
          <CommandInput placeholder="Buscar página…" />
          <CommandList className="max-h-[45vh]">
            <CommandEmpty className="py-6 text-sm text-muted-foreground">
              Nenhuma página encontrada.
            </CommandEmpty>
            <CommandGroup>
              {existingPages.map((page, index) => (
                <CommandItem
                  key={page.id}
                  value={`${page.storeName} ${index + 1}`}
                  onSelect={() => handleDuplicate(page.id)}
                  className="min-h-12 cursor-pointer"
                >
                  <span className="font-medium">
                    {index + 1}. {page.storeName}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      )}

      {mode === "template" && (
        <>
          <div className="rounded-lg border p-3">
            <PageTemplatePicker
              supplierId={supplierId ?? null}
              value={pageTemplateId}
              onChange={setPageTemplateId}
              label="Padrão de página"
            />
          </div>
          <Button
            type="button"
            className="h-12 w-full gap-2"
            disabled={isSaving || pageTemplateId === NO_PAGE_TEMPLATE}
            onClick={handleTemplateOnly}
          >
            {isSaving ? <Spinner /> : <Check className="size-4" />}
            Criar página com este padrão
          </Button>
        </>
      )}

      {mode === "full" && step === 1 && (
        <Command shouldFilter={false} className="rounded-md border">
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Buscar loja…"
          />
          <CommandList className="max-h-[45vh]">
            {isLoadingStores && (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            )}
            {!isLoadingStores && stores.length === 0 && (
              <CommandEmpty className="py-6">
                {search.trim() ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mx-auto h-11 gap-2"
                    disabled={createStore.isPending}
                    onClick={handleCreateStore}
                  >
                    {createStore.isPending ? (
                      <Spinner />
                    ) : (
                      <StoreIcon className="size-4" />
                    )}
                    Criar loja «{search.trim()}»
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Digite para buscar uma loja.
                  </span>
                )}
              </CommandEmpty>
            )}
            {!isLoadingStores && stores.length > 0 && (
              <CommandGroup>
                {stores.map((store) => (
                  <CommandItem
                    key={store.id}
                    value={store.id}
                    onSelect={() => selectStore(store.id, store.name)}
                    className="min-h-12 cursor-pointer flex-col items-start gap-0.5"
                  >
                    <span className="font-medium">{store.name}</span>
                    {(store.code || store.city) && (
                      <span className="text-xs text-muted-foreground">
                        {[
                          store.code,
                          [store.city, store.state].filter(Boolean).join("/"),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      )}

      {step === 2 && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {isLoadingMediaTypes && (
              <div className="col-span-2 flex justify-center py-6">
                <Spinner />
              </div>
            )}
            {mediaTypes.map((mediaType) => (
              <button
                key={mediaType.id}
                type="button"
                onClick={() => {
                  setMediaTypeId(mediaType.id);
                  setStep(3);
                }}
                className={cn(
                  "flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-lg border p-3 text-left transition-colors hover:border-primary",
                  mediaTypeId === mediaType.id && "border-primary bg-primary/5",
                )}
              >
                <span className="text-xs font-bold text-muted-foreground">
                  {mediaType.code}
                </span>
                <span className="text-sm font-medium leading-tight">
                  {mediaType.name}
                </span>
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setMediaTypeId(null);
              setStep(3);
            }}
          >
            Não informar a mídia
          </Button>

          <div className="rounded-lg border p-3">
            <PageTemplatePicker
              supplierId={supplierId ?? null}
              value={pageTemplateId}
              onChange={setPageTemplateId}
              label="Importar padrão de página"
            />
          </div>
        </>
      )}

      {step === 3 && (
        <>
          {(photoKeys.length > 0 || uploadingCount > 0) && (
            <div className="grid grid-cols-3 gap-2">
              {photoKeys.map((key) => (
                <div
                  key={key}
                  className="relative aspect-square overflow-hidden rounded-md border"
                >
                  {/* biome-ignore lint/performance/noImgElement: preview simples de key do R2 */}
                  <img
                    src={constructUrl(key)}
                    alt=""
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoKeys((prev) =>
                        prev.filter((current) => current !== key),
                      )
                    }
                    className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"
                    aria-label="Remover foto"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {Array.from({ length: uploadingCount }).map((_, index) => (
                <div
                  key={`uploading-${index}`}
                  className="flex aspect-square items-center justify-center rounded-md border"
                >
                  <Spinner />
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {photoKeys.length} de {MAX_PHOTOS} fotos
          </p>

          <PhotoCaptureInput
            onFiles={handleFiles}
            disabled={photoKeys.length >= MAX_PHOTOS}
            isUploading={uploadingCount > 0}
          />

          <Button
            type="button"
            className="h-12 w-full gap-2"
            disabled={isSaving || uploadingCount > 0}
            onClick={handleSave}
          >
            {isSaving ? <Spinner /> : <Check className="size-4" />}
            Salvar página
          </Button>
        </>
      )}
    </div>
  );

  const showBack = mode !== "choose";
  const goBack = () => {
    if (mode === "full" && step > 1) {
      setStep((current) => (current === 3 ? 2 : 1) as Step);
      return;
    }
    setMode("choose");
    setStep(1);
  };

  const header = (
    <div className="flex items-start gap-2">
      {showBack && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={goBack}
          aria-label="Voltar"
        >
          <ArrowLeft className="size-4" />
        </Button>
      )}
      <div className="space-y-1">
        {mode === "full" && (
          <span className="text-xs font-medium text-muted-foreground">
            Passo {step} de 3
          </span>
        )}
        <p className="text-lg font-semibold leading-none">{title}</p>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto px-4 pb-6"
        >
          <SheetHeader className="px-0">
            <SheetTitle asChild>{header}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* O DialogContent do shadcn só limita a largura. Sem teto de altura, a
          lista de tipos de mídia (dezenas de itens) empurrava o diálogo pra
          fora da tela, cortando o cabeçalho em cima e os botões embaixo. */}
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle asChild>{header}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* -mx-6/px-6 devolve o padding do DialogContent dentro da área que
            rola, senão a barra de rolagem corta o conteúdo rente à borda. */}
        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">{body}</div>
      </DialogContent>
    </Dialog>
  );
}
