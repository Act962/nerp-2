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
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfiniteScrollSentinel } from "@/hooks/use-infinite-scroll-sentinel";
import { PhotoCaptureInput } from "@/features/pdv-photos/components/photo-capture-input";
import {
  ArrowLeft,
  Camera,
  Factory,
  Star,
  Store as StoreIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  reverseGeocode,
  useCapturePromotorPhoto,
  useMyIndustries,
  useMyStores,
  useTogglePromotorFavorite,
} from "../hooks/use-promotor";
import { toast } from "sonner";
import { StampEditor } from "./stamp-editor";

type Selected = { id: string; name: string };

interface Geo {
  latitude?: number;
  longitude?: number;
  city: string | null;
  state: string | null;
  // Endereço resolvido junto com a cidade, na MESMA chamada de reverse-geocode.
  // Vai para a foto e, quando a loja está sem endereço, para a loja.
  road: string | null;
  houseNumber: string | null;
  suburb: string | null;
  label: string | null;
}

const EMPTY_GEO: Geo = {
  city: null,
  state: null,
  road: null,
  houseNumber: null,
  suburb: null,
  label: null,
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

/**
 * Estrela de favorito dentro de um `CommandItem`.
 *
 * O cmdk seleciona o item no clique em qualquer ponto da linha, então a estrela
 * precisa parar a propagação — senão favoritar avançaria o passo do wizard.
 * Alvo de 44px porque o promotor usa isso no celular, em pé, no corredor.
 */
function FavoriteToggle({
  isFavorite,
  label,
  onToggle,
}: {
  isFavorite: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={isFavorite ? `Desfavoritar ${label}` : `Favoritar ${label}`}
      aria-pressed={isFavorite}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Star
        className={cn("size-5", isFavorite && "fill-amber-400 text-amber-500")}
      />
    </button>
  );
}

export function CaptureWizard({
  promoterName,
  initialStore,
  initialSupplierId,
  initialSupplier,
  autoCapture,
  photoCredits,
  onCaptured,
}: {
  promoterName: string;
  // Loja vinda por contexto (do /mapa): pula a etapa de escolher a loja e
  // começa direto na "Escolha a Indústria".
  initialStore?: Selected | null;
  // Indústria vinda por contexto (da página de mídia): resolve na lista de
  // indústrias do promotor e pula direto para tirar a foto.
  initialSupplierId?: string;
  // Indústria já resolvida (fluxo "Refazer foto"): dispensa procurá-la na lista
  // do promotor, que é paginada e poderia não trazer justo essa.
  initialSupplier?: (Selected & { actionCodeImage: string | null }) | null;
  /** Abre a câmera sozinha ao chegar no passo da foto. */
  autoCapture?: boolean;
  /** Coordenação/supervisão marcada em Configurações para sair na foto. */
  photoCredits?: { name: string; role: string }[];
  /** Chamado após a foto ser aceita — a página usa para abrir "Minhas fotos". */
  onCaptured?: () => void;
}) {
  const hasFixedStore = !!initialStore;
  const minStep = hasFixedStore ? 2 : 1;
  const totalSteps = hasFixedStore ? 2 : 3;
  const [step, setStep] = useState<1 | 2 | 3>(
    initialSupplier ? 3 : hasFixedStore ? 2 : 1,
  );
  const [store, setStore] = useState<Selected | null>(initialStore ?? null);
  const [supplier, setSupplier] = useState<
    (Selected & { actionCodeImage: string | null }) | null
  >(initialSupplier ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [geo, setGeo] = useState<Geo>(EMPTY_GEO);
  const [capturedAt, setCapturedAt] = useState<Date | null>(null);

  const [storeSearch, setStoreSearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const debouncedStore = useDebouncedValue(storeSearch);
  const debouncedSupplier = useDebouncedValue(supplierSearch);
  const {
    stores,
    isLoading: loadingStores,
    hasNextPage: hasMoreStores,
    fetchNextPage: fetchMoreStores,
    isFetchingNextPage: loadingMoreStores,
  } = useMyStores(debouncedStore || undefined);
  const {
    suppliers,
    isLoading: loadingSuppliers,
    hasNextPage: hasMoreSuppliers,
    fetchNextPage: fetchMoreSuppliers,
    isFetchingNextPage: loadingMoreSuppliers,
  } = useMyIndustries(debouncedSupplier || undefined);

  const storeSentinelRef = useInfiniteScrollSentinel({
    hasNextPage: !!hasMoreStores,
    isFetchingNextPage: loadingMoreStores,
    fetchNextPage: fetchMoreStores,
  });
  const supplierSentinelRef = useInfiniteScrollSentinel({
    hasNextPage: !!hasMoreSuppliers,
    isFetchingNextPage: loadingMoreSuppliers,
    fetchNextPage: fetchMoreSuppliers,
  });

  const capture = useCapturePromotorPhoto();
  const toggleFavorite = useTogglePromotorFavorite();

  const favoriteStores = stores.filter((item) => item.isFavorite);
  const otherStores = stores.filter((item) => !item.isFavorite);
  const favoriteSuppliers = suppliers.filter((item) => item.isFavorite);
  const otherSuppliers = suppliers.filter((item) => !item.isFavorite);

  // Indústria vinda por deep-link: quando a lista do promotor carrega, encontra
  // a indústria e pula direto para a foto. Se não estiver entre as vinculadas,
  // apenas segue no passo de escolher a indústria.
  useEffect(() => {
    if (!initialSupplierId || supplier) return;
    const match = suppliers.find((item) => item.id === initialSupplierId);
    if (match?.actionCodeImage) {
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
        setGeo({ latitude, longitude, ...place });
      },
      () => {
        // Negado/indisponível: segue sem localização.
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [step]);

  const reset = () => {
    setStep(initialSupplier ? 3 : minStep);
    setStore(initialStore ?? null);
    setSupplier(initialSupplier ?? null);
    setFile(null);
    setGeo(EMPTY_GEO);
    setCapturedAt(null);
    setStoreSearch("");
    setSupplierSearch("");
  };

  const textLines = [
    promoterName,
    formatDateTime(capturedAt ?? new Date()),
    [geo.city, geo.state].filter(Boolean).join(" / "),
    store?.name ? `Cliente: ${store.name}` : "",
    ...(photoCredits ?? []).map((credit) => `${credit.role}: ${credit.name}`),
  ];

  const onBaked = (photoKey: string, sealMissing: boolean) => {
    if (!store || !supplier) return;
    capture.mutate(
      {
        storeId: store.id,
        supplierId: supplier.id,
        photoKey,
        sealMissing,
        capturedAt: (capturedAt ?? new Date()).toISOString(),
        latitude: geo.latitude,
        longitude: geo.longitude,
        capturedCity: geo.city ?? undefined,
        capturedState: geo.state ?? undefined,
        capturedAddress: geo.label ?? undefined,
        capturedRoad: geo.road ?? undefined,
        capturedHouseNumber: geo.houseNumber ?? undefined,
        capturedSuburb: geo.suburb ?? undefined,
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
            {[
              { heading: "Favoritos", items: favoriteStores },
              {
                heading: favoriteStores.length > 0 ? "Todas as lojas" : "",
                items: otherStores,
              },
            ]
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <CommandGroup
                  key={group.heading || "todas"}
                  heading={group.heading || undefined}
                >
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => {
                        setStore({ id: item.id, name: item.name });
                        setStep(2);
                      }}
                      className="min-h-12 cursor-pointer gap-2"
                    >
                      <StoreIcon className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.name}</p>
                        {(item.city || item.state) && (
                          <p className="truncate text-xs text-muted-foreground">
                            {[item.city, item.state]
                              .filter(Boolean)
                              .join(" / ")}
                          </p>
                        )}
                      </div>
                      <FavoriteToggle
                        isFavorite={item.isFavorite}
                        label={item.name}
                        onToggle={() => {
                          const favorite = !item.isFavorite;
                          toggleFavorite.mutate({
                            type: "store",
                            id: item.id,
                            favorite,
                          });
                          // Favoritar já vale como escolher: o promotor está
                          // marcando a loja onde está agora, então segue direto
                          // para a indústria. Desfavoritar só desmarca.
                          if (favorite) {
                            setStore({ id: item.id, name: item.name });
                            setStep(2);
                          }
                        }}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}

            {hasMoreStores && (
              <div ref={storeSentinelRef} className="flex justify-center py-3">
                {loadingMoreStores && <Spinner />}
              </div>
            )}
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
            {[
              { heading: "Favoritos", items: favoriteSuppliers },
              {
                heading:
                  favoriteSuppliers.length > 0 ? "Todas as indústrias" : "",
                items: otherSuppliers,
              },
            ]
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <CommandGroup
                  key={group.heading || "todas"}
                  heading={group.heading || undefined}
                >
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => {
                        // Sem imagem de código não há foto válida a produzir:
                        // deixar seguir só geraria uma captura que a
                        // coordenação teria de corrigir depois.
                        if (!item.actionCodeImage) {
                          toast.error(
                            "Indústria sem senha do mês. Solicite à coordenação.",
                          );
                          return;
                        }
                        setSupplier({
                          id: item.id,
                          name: item.name,
                          actionCodeImage: item.actionCodeImage,
                        });
                        setStep(3);
                      }}
                      className={cn(
                        "min-h-12 gap-2",
                        item.actionCodeImage
                          ? "cursor-pointer"
                          : "cursor-not-allowed opacity-60",
                      )}
                    >
                      <Factory className="size-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.name}</p>
                        {!item.actionCodeImage && (
                          <p className="truncate text-xs text-amber-600">
                            Sem senha do mês — solicite à coordenação
                          </p>
                        )}
                      </div>
                      <FavoriteToggle
                        isFavorite={item.isFavorite}
                        label={item.name}
                        onToggle={() => {
                          const favorite = !item.isFavorite;
                          toggleFavorite.mutate({
                            type: "supplier",
                            id: item.id,
                            favorite,
                          });
                          // Mesma lógica da loja: favoritar já escolhe a
                          // indústria e segue para a foto — mas só quando há
                          // selo, senão o atalho furaria o bloqueio acima.
                          if (favorite && item.actionCodeImage) {
                            setSupplier({
                              id: item.id,
                              name: item.name,
                              actionCodeImage: item.actionCodeImage,
                            });
                            setStep(3);
                          }
                        }}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}

            {hasMoreSuppliers && (
              <div
                ref={supplierSentinelRef}
                className="flex justify-center py-3"
              >
                {loadingMoreSuppliers && <Spinner />}
              </div>
            )}
          </CommandList>
        </Command>
      )}

      {step === 3 && !file && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {store?.name} · {supplier?.name}
          </p>
          <PhotoCaptureInput
            onFiles={(files) => setFile(files[0] ?? null)}
            autoOpen={autoCapture}
          />
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
