"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { PhotoCaptureInput } from "@/features/pdv-photos/components/photo-capture-input";
import { useStores } from "@/features/stores/hooks/use-stores";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import { useApprovedForImport } from "@/features/promotor/hooks/use-promotor";
import { constructUrl } from "@/hooks/use-construct-url";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { compressImage } from "@/lib/compress-image";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { Factory, Store as StoreIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ImportPhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Indústria do book, pré-selecionada.
  defaultSupplierId?: string | null;
  onPick: (photoKey: string) => void;
}

export function ImportPhotoDialog({
  open,
  onOpenChange,
  defaultSupplierId,
  onPick,
}: ImportPhotoDialogProps) {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(
    defaultSupplierId ?? null,
  );
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [storeSearch, setStoreSearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [uploading, setUploading] = useState(false);

  const { stores } = useStores({
    search: useDebouncedValue(storeSearch) || undefined,
    pageSize: 30,
  });
  const { suppliers } = useSupplier({
    search: useDebouncedValue(supplierSearch) || undefined,
    pageSize: 30,
  });

  // Só busca fotos aprovadas depois que a loja foi escolhida.
  const { photos, isLoading } = useApprovedForImport(
    storeId ?? undefined,
    supplierId ?? undefined,
    open && !!storeId,
  );

  const pick = (photoKey: string) => {
    onPick(photoKey);
    onOpenChange(false);
  };

  const uploadDirect = async (file: File) => {
    setUploading(true);
    try {
      const key = await uploadToR2(await compressImage(file), true);
      pick(key);
    } catch {
      toast.error("Não foi possível enviar a foto");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar foto</DialogTitle>
          <DialogDescription>
            Escolha o cliente e a indústria para importar uma foto aprovada do
            promotor — ou tire/envie uma foto direto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <Command shouldFilter={false} className="rounded-md border">
            <CommandInput
              value={storeSearch}
              onValueChange={setStoreSearch}
              placeholder="Cliente/loja…"
            />
            <CommandList className="max-h-40">
              <CommandEmpty className="py-4 text-xs text-muted-foreground">
                Nenhuma loja.
              </CommandEmpty>
              <CommandGroup>
                {stores.map((store) => (
                  <CommandItem
                    key={store.id}
                    value={store.id}
                    onSelect={() => {
                      setStoreId(store.id);
                      setStoreName(store.name);
                    }}
                    className={`cursor-pointer gap-2 ${storeId === store.id ? "bg-accent" : ""}`}
                  >
                    <StoreIcon className="size-4 text-muted-foreground" />
                    {store.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>

          <Command shouldFilter={false} className="rounded-md border">
            <CommandInput
              value={supplierSearch}
              onValueChange={setSupplierSearch}
              placeholder="Indústria…"
            />
            <CommandList className="max-h-40">
              <CommandEmpty className="py-4 text-xs text-muted-foreground">
                Nenhuma indústria.
              </CommandEmpty>
              <CommandGroup>
                {suppliers.map((supplier) => (
                  <CommandItem
                    key={supplier.id}
                    value={supplier.id}
                    onSelect={() => {
                      setSupplierId(supplier.id);
                      setSupplierName(supplier.name);
                    }}
                    className={`cursor-pointer gap-2 ${supplierId === supplier.id ? "bg-accent" : ""}`}
                  >
                    <Factory className="size-4 text-muted-foreground" />
                    {supplier.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>

        {(storeName || supplierName) && (
          <p className="text-xs text-muted-foreground">
            {storeName ?? "—"}
            {supplierName ? ` · ${supplierName}` : ""}
          </p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">Fotos aprovadas</p>
          {!storeId ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              Escolha um cliente para ver as fotos aprovadas.
            </p>
          ) : isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : photos.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              Nenhuma foto aprovada para este cliente/indústria.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => photo.photoKey && pick(photo.photoKey)}
                  className="aspect-square overflow-hidden rounded-md border transition-shadow hover:ring-2 hover:ring-primary"
                >
                  {/* biome-ignore lint/performance/noImgElement: thumbnail de key do R2 */}
                  <img
                    src={constructUrl(photo.photoKey)}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-medium">Ou tire/envie uma foto agora</p>
          <PhotoCaptureInput
            onFiles={(files) => files[0] && uploadDirect(files[0])}
            isUploading={uploading}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
