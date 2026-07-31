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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useStores } from "@/features/stores/hooks/use-stores";
import { PhotoCaptureInput } from "@/features/pdv-photos/components/photo-capture-input";
import { ArrowLeft, Camera, Factory, Store as StoreIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  reverseGeocode,
  useCapturePromotorPhoto,
  useMyIndustries,
} from "../hooks/use-promotor";
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

export function CaptureWizard({
  promoterName,
  initialStore,
  initialSupplierId,
  onCaptured,
}: {
  promoterName: string;
  // Loja vinda por contexto (do /mapa): pula a etapa de escolher a loja e
  // começa direto na "Escolha a Indústria".
  initialStore?: Selected | null;
  // Indústria vinda por contexto (da página de mídia): resolve na lista de
  // indústrias do promotor e pula direto para tirar a foto.
  initialSupplierId?: string;
  /** Chamado após a foto ser aceita — a página usa para abrir "Minhas fotos". */
  onCaptured?: () => void;
}) {
  const hasFixedStore = !!initialStore;
  const minStep = hasFixedStore ? 2 : 1;
  const totalSteps = hasFixedStore ? 2 : 3;
  const [step, setStep] = useState<1 | 2 | 3>(hasFixedStore ? 2 : 1);
  const [store, setStore] = useState<Selected | null>(initialStore ?? null);
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
  const { suppliers, isLoading: loadingSuppliers } = useMyIndustries(
    debouncedSupplier || undefined,
  );

  const capture = useCapturePromotorPhoto();

  // Indústria vinda por deep-link: quando a lista do promotor carrega, encontra
  // a indústria e pula direto para a foto. Se não estiver entre as vinculadas,
  // apenas segue no passo de escolher a indústria.
  useEffect(() => {
    if (!initialSupplierId || supplier) return;
    const match = suppliers.find((item) => item.id === initialSupplierId);
    if (match) {
      setSupplier({
        id: match.id,
        name: match.name,
        actionCodeImage: match.actionCodeImage,
      });
      setStep(3);
    }
  }, [initialSupplierId, supplier, suppliers]);

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
    setStep(minStep);
    setStore(initialStore ?? null);
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
      {
        onSuccess: () => {
          reset();
          onCaptured?.();
        },
      },
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
        {step > minStep && !file && (
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
            Passo {step - (minStep - 1)} de {totalSteps}
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
                  <Factory className="size-5 text-muted-foreground" />
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
