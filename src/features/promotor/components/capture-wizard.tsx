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
import { type GeoStatus, useGeolocation } from "@/hooks/use-geolocation";
import {
  ArrowLeft,
  Camera,
  Factory,
  LocateFixed,
  MapPin,
  MapPinOff,
  Star,
  Store as StoreIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

// Endereço resolvido no reverse-geocode. As coordenadas em si vêm do hook de
// geolocalização (`position`), não daqui.
interface Place {
  city: string | null;
  state: string | null;
  road: string | null;
  houseNumber: string | null;
  suburb: string | null;
  label: string | null;
}

const EMPTY_PLACE: Place = {
  city: null,
  state: null,
  road: null,
  houseNumber: null,
  suburb: null,
  label: null,
};

// Acima disto a precisão é ruim demais para provar "estava na porta da loja";
// não bloqueia (a foto nunca trava), mas sugere tentar de novo.
const LOW_ACCURACY_M = 100;

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

/**
 * Estado da localização no passo da foto. Nunca bloqueia a captura — só informa
 * e oferece ativar/tentar de novo, para o promotor religar quando puder.
 */
function LocationPrimer({
  status,
  accuracy,
  city,
  onEnable,
}: {
  status: GeoStatus;
  accuracy: number | null;
  city: string | null;
  onEnable: () => void;
}) {
  const base = "flex items-start gap-2 rounded-md border px-3 py-2 text-sm";

  if (status === "on") {
    const lowAccuracy = accuracy !== null && accuracy > LOW_ACCURACY_M;
    return (
      <div
        className={cn(
          base,
          lowAccuracy
            ? "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
        )}
      >
        <LocateFixed className="mt-0.5 size-4 shrink-0" />
        <div className="flex-1">
          <p className="font-medium">
            {lowAccuracy ? "Localização imprecisa" : "Localização ativa"}
          </p>
          <p className="text-xs opacity-90">
            {[city, accuracy !== null ? `~${Math.round(accuracy)} m` : null]
              .filter(Boolean)
              .join(" · ") || "Posição obtida"}
          </p>
          {lowAccuracy && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-amber-800 dark:text-amber-200"
              onClick={onEnable}
            >
              Tentar melhorar
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (status === "asking") {
    return (
      <div className={cn(base, "text-muted-foreground")}>
        <Spinner className="mt-0.5 size-4 shrink-0" />
        <p>Obtendo sua localização…</p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div
        className={cn(
          base,
          "border-destructive/40 bg-destructive/10 text-destructive",
        )}
      >
        <MapPinOff className="mt-0.5 size-4 shrink-0" />
        <div className="flex-1">
          <p className="font-medium">Localização desativada</p>
          <p className="text-xs opacity-90">
            Toque no ícone de site (cadeado) na barra do navegador, permita a
            Localização e toque em Tentar de novo.
          </p>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-destructive"
            onClick={onEnable}
          >
            Tentar de novo
          </Button>
        </div>
      </div>
    );
  }

  // "off" (ainda não pediu) e "unavailable" (indisponível/timeout): CTA para
  // ativar/tentar. A foto continua liberada abaixo de qualquer forma.
  return (
    <div className={cn(base, "text-muted-foreground")}>
      <MapPin className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1">
        <p className="font-medium text-foreground">
          {status === "unavailable"
            ? "Não foi possível obter a localização"
            : "Ative a localização"}
        </p>
        <p className="text-xs">
          Registramos onde a foto foi tirada — ajuda a coordenação a ver a
          cobertura em campo.
        </p>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={onEnable}
        >
          {status === "unavailable" ? "Tentar de novo" : "Ativar localização"}
        </Button>
      </div>
    </div>
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
  const [place, setPlace] = useState<Place>(EMPTY_PLACE);
  const [capturedAt, setCapturedAt] = useState<Date | null>(null);

  // Localização via hook compartilhado: `autoStartIfGranted` religa sozinho
  // quando a permissão já foi concedida; sem isso, o promotor toca "Ativar
  // localização" (gesto), evitando a negação permanente do disparo automático.
  const {
    position,
    status: geoStatus,
    start: startGeo,
  } = useGeolocation({
    autoStartIfGranted: true,
  });
  // Garante um único reverse-geocode por captura, mesmo com o watch atualizando
  // a posição várias vezes.
  const geocodedRef = useRef(false);

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

  // Ao chegar no passo 3, marca o horário da captura.
  useEffect(() => {
    if (step !== 3) return;
    setCapturedAt(new Date());
  }, [step]);

  // Resolve cidade/estado/endereço a partir da primeira posição obtida. As
  // coordenadas em si sempre vêm de `position` no momento do envio.
  useEffect(() => {
    if (!position || geocodedRef.current) return;
    geocodedRef.current = true;
    reverseGeocode(position.latitude, position.longitude)
      .then(setPlace)
      .catch(() => {
        // Sem o endereço textual a foto ainda vai com a coordenada; a linha de
        // cidade no carimbo apenas fica de fora.
      });
  }, [position]);

  const reset = () => {
    setStep(initialSupplier ? 3 : minStep);
    setStore(initialStore ?? null);
    setSupplier(initialSupplier ?? null);
    setFile(null);
    setPlace(EMPTY_PLACE);
    geocodedRef.current = false;
    setCapturedAt(null);
    setStoreSearch("");
    setSupplierSearch("");
  };

  const textLines = [
    promoterName,
    formatDateTime(capturedAt ?? new Date()),
    [place.city, place.state].filter(Boolean).join(" / "),
    store?.name ? `Cliente: ${store.name}` : "",
    ...(photoCredits ?? []).map((credit) => `${credit.role}: ${credit.name}`),
  ];

  // Traduz o estado do hook no motivo gravado por foto: com posição é OK; sem
  // ela, distingue negado de indisponível (inclui timeout) para o gestor.
  const locationStatus: "OK" | "DENIED" | "UNAVAILABLE" = position
    ? "OK"
    : geoStatus === "denied"
      ? "DENIED"
      : "UNAVAILABLE";

  const onBaked = (photoKey: string, sealMissing: boolean) => {
    if (!store || !supplier) return;
    capture.mutate(
      {
        storeId: store.id,
        supplierId: supplier.id,
        photoKey,
        sealMissing,
        capturedAt: (capturedAt ?? new Date()).toISOString(),
        latitude: position?.latitude,
        longitude: position?.longitude,
        capturedAccuracy: position?.accuracy,
        locationStatus,
        capturedCity: place.city ?? undefined,
        capturedState: place.state ?? undefined,
        capturedAddress: place.label ?? undefined,
        capturedRoad: place.road ?? undefined,
        capturedHouseNumber: place.houseNumber ?? undefined,
        capturedSuburb: place.suburb ?? undefined,
      },
      {
        onSuccess: (result) => {
          if (result.offSite) {
            toast.warning("Foto longe do local da loja", {
              description:
                "O GPS ficou distante do endereço desta loja. A coordenação vai ver o alerta na aprovação.",
              duration: 8000,
            });
          }
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
          <LocationPrimer
            status={geoStatus}
            accuracy={position?.accuracy ?? null}
            city={place.city}
            onEnable={startGeo}
          />
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
