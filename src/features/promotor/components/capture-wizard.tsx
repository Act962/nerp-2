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
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useStores } from "@/features/stores/hooks/use-stores";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import { PhotoCaptureInput } from "@/features/pdv-photos/components/photo-capture-input";
import { ArrowLeft, Camera, Factory, Store as StoreIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { reverseGeocode, useCapturePromotorPhoto } from "../hooks/use-promotor";
import { StampEditor } from "./stamp-editor";

type Selected = { id: string; name: string };

interface Geo {
  latitude?: number;
  longitude?: number;
  city: string | null;
  state: string | null;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function CaptureWizard({ promoterName }: { promoterName: string }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [store, setStore] = useState<Selected | null>(null);
  const [supplier, setSupplier] = useState<
    (Selected & { actionCodeImage: string | null }) | null
  >(null);
  const [file, setFile] = useState<File | null>(null);
  const [geo, setGeo] = useState<Geo>({ city: null, state: null });
  const [capturedAt, setCapturedAt] = useState<Date | null>(null);

  const [storeSearch, setStoreSearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const debouncedStore = useDebouncedValue(storeSearch);
  const debouncedSupplier = useDebouncedValue(supplierSearch);
  const { stores, isLoading: loadingStores } = useStores(
    debouncedStore || undefined,
  );
  const { suppliers, isLoading: loadingSuppliers } = useSupplier({
    search: debouncedSupplier || undefined,
    pageSize: 30,
  });

  const capture = useCapturePromotorPhoto();

  // Ao chegar no passo 3, pega a localização (best-effort) e o horário.
  useEffect(() => {
    if (step !== 3) return;
    setCapturedAt(new Date());
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const place = await reverseGeocode(latitude, longitude);
        setGeo({ latitude, longitude, city: place.city, state: place.state });
      },
      () => {
        // Negado/indisponível: segue sem localização.
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [step]);

  const reset = () => {
    setStep(1);
    setStore(null);
    setSupplier(null);
    setFile(null);
    setGeo({ city: null, state: null });
    setCapturedAt(null);
    setStoreSearch("");
    setSupplierSearch("");
  };

  const textLines = [
    promoterName,
    formatDateTime(capturedAt ?? new Date()),
    [geo.city, geo.state].filter(Boolean).join(" / "),
    store?.name ? `Cliente: ${store.name}` : "",
  ];

  const onBaked = (photoKey: string) => {
    if (!store || !supplier) return;
    capture.mutate(
      {
        storeId: store.id,
        supplierId: supplier.id,
        photoKey,
        capturedAt: (capturedAt ?? new Date()).toISOString(),
        latitude: geo.latitude,
        longitude: geo.longitude,
        capturedCity: geo.city ?? undefined,
        capturedState: geo.state ?? undefined,
      },
      { onSuccess: reset },
    );
  };

  const title =
    step === 1
      ? "Escolha o cliente/supermercado"
      : step === 2
        ? "Escolha a indústria"
        : "Tirar foto";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {step > 1 && !file && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setStep((current) => (current - 1) as 1 | 2 | 3)}
            aria-label="Voltar"
          >
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <div>
          <span className="text-xs font-medium text-muted-foreground">
            Passo {step} de 3
          </span>
          <p className="text-lg font-semibold leading-tight">{title}</p>
        </div>
      </div>

      {step === 1 && (
        <Command shouldFilter={false} className="rounded-md border">
          <CommandInput
            value={storeSearch}
            onValueChange={setStoreSearch}
            placeholder="Buscar loja…"
          />
          <CommandList className="max-h-[55vh]">
            {loadingStores && (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            )}
            {!loadingStores && stores.length === 0 && (
              <CommandEmpty className="py-6 text-sm text-muted-foreground">
                Nenhuma loja encontrada.
              </CommandEmpty>
            )}
            <CommandGroup>
              {stores.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => {
                    setStore({ id: item.id, name: item.name });
                    setStep(2);
                  }}
                  className="min-h-12 cursor-pointer gap-2"
                >
                  <StoreIcon className="size-4 text-muted-foreground" />
                  <span className="font-medium">{item.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      )}

      {step === 2 && (
        <Command shouldFilter={false} className="rounded-md border">
          <CommandInput
            value={supplierSearch}
            onValueChange={setSupplierSearch}
            placeholder="Buscar indústria…"
          />
          <CommandList className="max-h-[55vh]">
            {loadingSuppliers && (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            )}
            {!loadingSuppliers && suppliers.length === 0 && (
              <CommandEmpty className="py-6 text-sm text-muted-foreground">
                Nenhuma indústria encontrada.
              </CommandEmpty>
            )}
            <CommandGroup>
              {suppliers.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => {
                    setSupplier({
                      id: item.id,
                      name: item.name,
                      actionCodeImage: item.actionCodeImage,
                    });
                    setStep(3);
                  }}
                  className="min-h-12 cursor-pointer gap-2"
                >
                  {item.logo ? (
                    // biome-ignore lint/performance/noImgElement: thumbnail simples de key do R2
                    <img
                      src={constructUrl(item.logo)}
                      alt=""
                      className="size-8 rounded object-contain"
                    />
                  ) : (
                    <Factory className="size-5 text-muted-foreground" />
                  )}
                  <span className="font-medium">{item.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      )}

      {step === 3 && !file && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {store?.name} · {supplier?.name}
          </p>
          <PhotoCaptureInput onFiles={(files) => setFile(files[0] ?? null)} />
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Camera className="size-3" />
            Enquadre mostrando os produtos, com boa iluminação e sem poluição
            visual.
          </p>
        </div>
      )}

      {step === 3 && file && (
        <StampEditor
          file={file}
          codigoKey={supplier?.actionCodeImage ?? null}
          textLines={textLines}
          onCancel={() => setFile(null)}
          onBaked={onBaked}
        />
      )}

      {capture.isPending && (
        <p className="text-center text-sm text-muted-foreground">Enviando…</p>
      )}
    </div>
  );
}
