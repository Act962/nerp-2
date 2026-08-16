"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Clock,
  Download,
  Factory,
  ImagePlus,
  MapPin,
  Send,
  Share2,
  Store as StoreIcon,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  type PhotoRef,
  downloadPhotos,
  sharePhotosToWhatsapp,
} from "../lib/photo-actions";
import {
  type DateRange,
  DateRangeFilter,
  rangeToInstants,
} from "./date-range-filter";
import {
  type PromotorPhotoStatus,
  useGalleryDrafts,
  useMyPhotoCounts,
  useMyPhotoGroups,
  useMyPhotos,
  usePromotorProfile,
  useSubmitGalleryPhotos,
} from "../hooks/use-promotor";
import { CaptureWizard } from "./capture-wizard";

const FILTERS: { value: PromotorPhotoStatus; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "APP_GALLERY", label: "Galeria App" },
  { value: "APPROVED", label: "Aprovadas" },
  { value: "REJECTED", label: "Reprovadas" },
  { value: "PENDING", label: "Pendentes" },
];

function StatusBadge({
  status,
}: {
  status: "APPROVED" | "REJECTED" | "PENDING";
}) {
  if (status === "APPROVED") {
    return (
      <Badge className="gap-1 bg-emerald-600">
        <Check className="size-3" /> Aprovada
      </Badge>
    );
  }
  if (status === "REJECTED") {
    return (
      <Badge variant="destructive" className="gap-1">
        <X className="size-3" /> Reprovada
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="size-3" /> Pendente
    </Badge>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(iso),
  );
}

/**
 * "Minhas fotos" em três níveis: clientes → indústrias → fotos.
 *
 * A versão anterior renderizava tudo de uma vez. Com 100 clientes e meses de
 * histórico isso é um scroll interminável e centenas de miniaturas baixadas
 * para achar uma foto. Aqui os dois primeiros níveis só trazem nome, contagem
 * e data (agregados no banco), e as imagens só descem no terceiro.
 */
export interface RetakeTarget {
  store: { id: string; name: string };
  supplier: { id: string; name: string; actionCodeImage: string | null };
}

export function MyPhotosList({
  initialStatus = "ALL",
  onRetake,
}: {
  initialStatus?: PromotorPhotoStatus;
  /** "Refazer foto": devolve loja + indústria da reprovada para a captura. */
  onRetake?: (target: RetakeTarget) => void;
}) {
  const [filter, setFilter] = useState<PromotorPhotoStatus>(initialStatus);
  const [store, setStore] = useState<{ id: string; name: string } | null>(null);
  const [supplier, setSupplier] = useState<{
    id: string | null;
    name: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>({});
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  // Dentro do chip "Galeria App": false = mostra as fotos do banco; true = abre
  // o fluxo de captura (loja > indústria > tirar foto).
  const [galleryAdding, setGalleryAdding] = useState(false);
  const [gallerySelected, setGallerySelected] = useState<Set<string>>(
    new Set(),
  );
  const [galleryStore, setGalleryStore] = useState("all");
  const [galleryStoreSearch, setGalleryStoreSearch] = useState("");
  const [gallerySupplier, setGallerySupplier] = useState("all");

  const exitSelection = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  // Na raiz, um filtro de status abre a lista CORRIDA daquele status, misturando
  // clientes e indústrias: quem clica em "Reprovadas" quer as reprovadas para
  // refazer, não navegar cliente por cliente atrás delas. A hierarquia fica
  // para "Todas", que é modo de consulta, e continua valendo dentro de um
  // cliente já aberto.
  // "Galeria App" não é um status: é o banco de fotos avulsas (captura em massa).
  // Renderiza o CaptureWizard em modo galeria em vez da navegação normal.
  const showGallery = filter === "APP_GALLERY";
  const isFlat = store === null && filter !== "ALL" && !showGallery;
  const atPhotos = isFlat || (store !== null && supplier !== null);

  const dates = rangeToInstants(range);
  const { groups, isLoading: loadingGroups } = useMyPhotoGroups(
    filter,
    store?.id,
    !atPhotos && !showGallery,
    dates,
  );
  const { photos, isLoading: loadingPhotos } = useMyPhotos(
    filter,
    isFlat ? dates : { storeId: store?.id, supplierId: supplier?.id, ...dates },
    atPhotos && !showGallery,
  );
  const { counts } = useMyPhotoCounts({
    ...(store ? { storeId: store.id, supplierId: supplier?.id } : {}),
    ...dates,
  });
  const { profile } = usePromotorProfile();
  // Banco da Galeria App (todos os rascunhos do promotor, sem filtrar loja).
  const { photos: galleryDrafts, isLoading: loadingGallery } = useGalleryDrafts(
    undefined,
    showGallery && !galleryAdding,
  );
  const submitGallery = useSubmitGalleryPhotos();

  // Opções de filtro (loja/indústria) derivadas do próprio banco.
  const galleryStores = [
    ...new Set(galleryDrafts.map((p) => p.storeName)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const gallerySuppliers = [
    ...new Set(
      galleryDrafts
        .map((p) => p.supplierName)
        .filter((n): n is string => Boolean(n)),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filteredDrafts = galleryDrafts.filter(
    (p) =>
      (galleryStore === "all" || p.storeName === galleryStore) &&
      (gallerySupplier === "all" || p.supplierName === gallerySupplier),
  );
  const toggleGallerySelected = (id: string) =>
    setGallerySelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allGallerySelected =
    filteredDrafts.length > 0 &&
    filteredDrafts.every((p) => gallerySelected.has(p.id));

  const opened = photos.find((photo) => photo.id === openedId) ?? null;

  const approved = photos.filter(
    (photo) => photo.status === "APPROVED" && photo.photoKey,
  );
  const toRefs = (list: typeof photos): PhotoRef[] =>
    list
      .filter((photo) => photo.photoKey)
      .map((photo) => ({
        photoKey: photo.photoKey as string,
        storeName: photo.storeName,
        supplierName: photo.supplierName,
        capturedAt: photo.capturedAt,
      }));
  const selectedPhotos = approved.filter((photo) => selected.has(photo.id));

  const toggleSelected = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const download = async (list: typeof photos) => {
    setBusy(true);
    const failed = await downloadPhotos(toRefs(list));
    setBusy(false);
    if (failed > 0) {
      toast.error(`${failed} foto(s) não puderam ser baixadas`);
    } else if (list.length > 1) {
      toast.success(`${list.length} fotos baixadas`);
    }
  };

  const share = async (list: typeof photos) => {
    setBusy(true);
    const outcome = await sharePhotosToWhatsapp(toRefs(list), constructUrl);
    setBusy(false);
    if (outcome === "unsupported") {
      toast.error("Este navegador não envia várias fotos de uma vez", {
        description: "Baixe as fotos e anexe no WhatsApp, ou envie uma a uma.",
      });
    }
  };

  const visibleGroups = search.trim()
    ? groups.filter((group) =>
        group.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : groups;

  const countFor = (value: PromotorPhotoStatus) =>
    value === "ALL"
      ? counts.all
      : value === "APP_GALLERY"
        ? counts.appGallery
        : value === "APPROVED"
          ? counts.approved
          : value === "REJECTED"
            ? counts.rejected
            : counts.pending;

  const goBack = () => {
    exitSelection();
    if (supplier) {
      setSupplier(null);
      return;
    }
    setStore(null);
    setSearch("");
  };

  return (
    <div className="space-y-4">
      {/* Trilha: some no topo, onde não há de onde voltar. */}
      {store && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            aria-label="Voltar"
            className="flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-accent"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {store.name}
            </p>
            {supplier && (
              <p className="truncate text-xs text-muted-foreground">
                {supplier.name}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((option) => {
          const active = filter === option.value;
          const count = countFor(option.value);
          const alertRejected = option.value === "REJECTED" && count > 0;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setFilter(option.value);
                setSearch("");
                exitSelection();
                setGalleryAdding(false);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              {option.label}
              <span
                className={`rounded-full px-1.5 text-xs font-semibold ${
                  alertRejected && !active
                    ? "bg-red-600 text-white"
                    : active
                      ? "bg-primary-foreground/20"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {showGallery ? (
        galleryAdding ? (
          <div className="space-y-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => setGalleryAdding(false)}
            >
              <ArrowLeft className="size-4" /> Voltar para a galeria
            </Button>
            <CaptureWizard
              key="galeria-mine"
              galleryMode
              promoterName={profile?.name ?? ""}
              photoCredits={profile?.photoCredits}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Botão de largura total, em cima das fotos. */}
            <Button
              type="button"
              className="h-11 w-full gap-2"
              onClick={() => setGalleryAdding(true)}
            >
              <ImagePlus className="size-4" /> Adicionar fotos na galeria
            </Button>

            {loadingGallery ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : galleryDrafts.length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma foto na galeria ainda. Toque em "Adicionar fotos na
                galeria" para tirar em massa.
              </p>
            ) : (
              <>
                {/* Filtros por loja e indústria. */}
                <div className="flex flex-wrap gap-2">
                  <Select value={galleryStore} onValueChange={setGalleryStore}>
                    <SelectTrigger size="sm" className="w-[150px]">
                      <SelectValue placeholder="Loja" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-1">
                        <Input
                          value={galleryStoreSearch}
                          onChange={(e) =>
                            setGalleryStoreSearch(e.target.value)
                          }
                          onKeyDown={(e) => e.stopPropagation()}
                          placeholder="Buscar loja…"
                          className="h-8"
                        />
                      </div>
                      <SelectItem value="all">Todas as lojas</SelectItem>
                      {galleryStores
                        .filter((name) =>
                          name
                            .toLowerCase()
                            .includes(galleryStoreSearch.trim().toLowerCase()),
                        )
                        .map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={gallerySupplier}
                    onValueChange={setGallerySupplier}
                  >
                    <SelectTrigger size="sm" className="w-[160px]">
                      <SelectValue placeholder="Indústria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as indústrias</SelectItem>
                      {gallerySuppliers.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() =>
                      setGallerySelected(
                        allGallerySelected
                          ? new Set()
                          : new Set(filteredDrafts.map((p) => p.id)),
                      )
                    }
                  >
                    {allGallerySelected ? "Limpar seleção" : "Selecionar todas"}
                  </Button>
                </div>

                {filteredDrafts.length === 0 ? (
                  <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nenhuma foto nesse filtro.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {filteredDrafts.map((photo) => {
                      const isSelected = gallerySelected.has(photo.id);
                      return (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => toggleGallerySelected(photo.id)}
                          className={`relative overflow-hidden rounded-md border text-left transition-shadow ${
                            isSelected
                              ? "ring-2 ring-primary"
                              : "hover:ring-2 hover:ring-primary/50"
                          }`}
                        >
                          <div className="aspect-square">
                            {/* biome-ignore lint/performance/noImgElement: thumbnail de key do R2 */}
                            <img
                              src={constructUrl(photo.photoKey)}
                              alt=""
                              loading="lazy"
                              className="size-full object-cover"
                            />
                          </div>
                          {isSelected && (
                            <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-3" />
                            </span>
                          )}
                          {photo.possibleReuse && (
                            <span className="absolute bottom-5 left-1 flex items-center gap-0.5 rounded bg-amber-500/90 px-1 py-0.5 text-[9px] font-semibold text-white">
                              <AlertTriangle className="size-2.5" /> reuso?
                            </span>
                          )}
                          <div className="px-1 py-0.5">
                            <p className="truncate text-[10px] font-medium leading-tight">
                              {photo.storeName}
                            </p>
                            <p className="truncate text-[10px] leading-tight text-muted-foreground">
                              {photo.supplierName ?? "Sem indústria"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <Button
                  type="button"
                  className="h-11 w-full gap-2"
                  disabled={
                    gallerySelected.size === 0 || submitGallery.isPending
                  }
                  onClick={() =>
                    submitGallery.mutate(
                      { photoIds: [...gallerySelected] },
                      {
                        onSuccess: (r) => {
                          toast.success(
                            `${r.submitted} foto(s) enviada(s) para aprovação`,
                          );
                          setGallerySelected(new Set());
                        },
                      },
                    )
                  }
                >
                  <Send className="size-4" /> Enviar
                  {gallerySelected.size > 0 ? ` ${gallerySelected.size}` : ""}{" "}
                  para aprovação
                </Button>
              </>
            )}
          </div>
        )
      ) : (
        <>
          <DateRangeFilter value={range} onChange={setRange} />

          {!atPhotos && groups.length > 8 && (
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={store ? "Buscar indústria…" : "Buscar cliente…"}
              className="h-11"
            />
          )}

          {(!atPhotos && loadingGroups) || (atPhotos && loadingPhotos) ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : !atPhotos ? (
            visibleGroups.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhuma foto nesta lista.
              </p>
            ) : (
              <ul className="rounded-md border">
                {visibleGroups.map((group) => (
                  <li
                    key={group.id ?? "sem"}
                    className="border-b last:border-0"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (store) {
                          setSupplier({ id: group.id, name: group.name });
                        } else if (group.id) {
                          setStore({ id: group.id, name: group.name });
                          setSearch("");
                        }
                      }}
                      className="flex w-full items-center gap-2 px-3 py-3 text-left hover:bg-accent"
                    >
                      {store ? (
                        <Factory className="size-5 shrink-0 text-muted-foreground" />
                      ) : (
                        <StoreIcon className="size-5 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {group.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {group.total} foto{group.total === 1 ? "" : "s"}
                          {group.lastCapturedAt &&
                            ` · última em ${formatDate(group.lastCapturedAt)}`}
                        </p>
                      </div>
                      {group.rejected > 0 && (
                        <Badge variant="destructive" className="shrink-0">
                          {group.rejected}
                        </Badge>
                      )}
                      {group.pending > 0 && (
                        <Badge variant="secondary" className="shrink-0">
                          {group.pending}
                        </Badge>
                      )}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : photos.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma foto nesta lista.
            </p>
          ) : (
            <div className="space-y-3">
              {approved.length > 1 && (
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      selecting ? exitSelection() : setSelecting(true)
                    }
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {selecting ? "Cancelar seleção" : "Selecionar fotos"}
                  </button>
                  {selecting && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelected(
                          selected.size === approved.length
                            ? new Set()
                            : new Set(approved.map((photo) => photo.id)),
                        )
                      }
                      className="text-sm text-muted-foreground hover:underline"
                    >
                      {selected.size === approved.length
                        ? "Limpar"
                        : "Selecionar todas"}
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="overflow-hidden rounded-lg border bg-card"
                  >
                    <div className="relative aspect-square bg-neutral-900">
                      {selecting && photo.status === "APPROVED" && (
                        <span
                          className={`absolute right-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full border-2 ${
                            selected.has(photo.id)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-white/80 bg-black/40"
                          }`}
                        >
                          {selected.has(photo.id) && (
                            <Check className="size-3.5" />
                          )}
                        </span>
                      )}
                      {photo.photoKey && (
                        <button
                          type="button"
                          onClick={() =>
                            selecting && photo.status === "APPROVED"
                              ? toggleSelected(photo.id)
                              : setOpenedId(photo.id)
                          }
                          className="size-full cursor-zoom-in"
                          title={selecting ? "Selecionar" : "Ampliar foto"}
                        >
                          {/* `object-contain` pelo mesmo motivo da fila de aprovação:
                      com `cover`, foto em retrato perdia as pontas e o carimbo
                      do código (a 6% do topo) ficava fora do quadro. */}
                          {/* biome-ignore lint/performance/noImgElement: thumbnail de key do R2 */}
                          <img
                            src={constructUrl(photo.photoKey)}
                            alt={`Foto em ${photo.storeName}`}
                            loading="lazy"
                            className="size-full object-contain"
                          />
                        </button>
                      )}
                    </div>
                    <div className="space-y-1 p-2">
                      <StatusBadge status={photo.status} />
                      {/* Na lista corrida o card é a única pista de onde a foto foi
                  tirada — dentro de um cliente isso já está no cabeçalho. */}
                      {isFlat && (
                        <>
                          <p className="truncate text-xs font-medium">
                            {photo.storeName}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {photo.supplierName ?? "Sem indústria"}
                          </p>
                        </>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(photo.capturedAt)}
                      </p>
                      {photo.status === "REJECTED" && photo.rejectionNote && (
                        <p className="rounded bg-red-50 px-1.5 py-1 text-[11px] text-red-700">
                          Motivo: {photo.rejectionNote}
                        </p>
                      )}

                      {/* Refazer: volta à captura com a MESMA loja e indústria. Sem
                    isso o promotor teria que reencontrar as duas no wizard —
                    justamente quem já está no corredor esperando para repetir. */}
                      {photo.status === "REJECTED" &&
                        onRetake &&
                        photo.supplierId && (
                          <Button
                            type="button"
                            size="sm"
                            className="mt-1 h-9 w-full gap-1.5"
                            onClick={() =>
                              onRetake({
                                store: {
                                  id: photo.storeId,
                                  name: photo.storeName,
                                },
                                supplier: {
                                  id: photo.supplierId as string,
                                  name: photo.supplierName ?? "",
                                  actionCodeImage:
                                    photo.supplierActionCodeImage,
                                },
                              })
                            }
                          >
                            <Camera className="size-4" /> Refazer foto
                          </Button>
                        )}

                      {/* Só aprovadas: pendente ou reprovada não deve circular — é
                  material que a coordenação ainda não liberou. */}
                      {photo.status === "APPROVED" &&
                        !selecting &&
                        photo.photoKey && (
                          <div className="flex gap-1 pt-0.5">
                            <button
                              type="button"
                              onClick={() => share([photo])}
                              disabled={busy}
                              aria-label="Enviar no WhatsApp"
                              className="flex h-9 flex-1 items-center justify-center rounded-md bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <Share2 className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => download([photo])}
                              disabled={busy}
                              aria-label="Baixar foto"
                              className="flex h-9 flex-1 items-center justify-center rounded-md border transition-colors hover:bg-accent disabled:opacity-50"
                            >
                              <Download className="size-4" />
                            </button>
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barra de ação da seleção. Fixa no rodapé: no celular a lista é longa e
        subir até o topo para confirmar seria um percurso inútil. */}
          {selecting && (
            <div className="sticky bottom-2 z-20 flex items-center gap-2 rounded-lg border bg-background/95 p-2 shadow-lg backdrop-blur">
              <span className="px-1 text-sm font-medium tabular-nums">
                {selected.size} selecionada{selected.size === 1 ? "" : "s"}
              </span>
              <Button
                type="button"
                size="sm"
                className="ml-auto gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                disabled={busy || selected.size === 0}
                onClick={() => share(selectedPhotos)}
              >
                <Share2 className="size-4" /> Enviar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={busy || selected.size === 0}
                onClick={() => download(selectedPhotos)}
              >
                <Download className="size-4" /> Baixar
              </Button>
            </div>
          )}

          <Dialog
            open={opened !== null}
            onOpenChange={(isOpen) => {
              if (!isOpen) setOpenedId(null);
            }}
          >
            <DialogContent className="max-w-3xl">
              {opened && (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-base">
                      {opened.storeName}
                    </DialogTitle>
                    <DialogDescription>
                      {opened.supplierName ?? "Sem indústria"}
                      {(opened.capturedCity || opened.capturedState) &&
                        ` · ${[opened.capturedCity, opened.capturedState]
                          .filter(Boolean)
                          .join("/")}`}
                    </DialogDescription>
                  </DialogHeader>

                  {opened.photoKey && (
                    // `max-h-[70vh]` + `object-contain`: foto de PDV costuma ser
                    // retrato, e sem o teto ela empurra o rodapé do diálogo para
                    // fora da tela no celular.
                    // biome-ignore lint/performance/noImgElement: imagem de key do R2
                    <img
                      src={constructUrl(opened.photoKey)}
                      alt={`Foto em ${opened.storeName}`}
                      className="max-h-[70vh] w-full rounded-md object-contain"
                    />
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={opened.status} />
                    {(opened.capturedCity || opened.capturedState) && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <MapPin className="size-3" />
                        {[opened.capturedCity, opened.capturedState]
                          .filter(Boolean)
                          .join("/")}
                      </span>
                    )}
                    {opened.status === "REJECTED" && opened.rejectionNote && (
                      <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                        Motivo: {opened.rejectionNote}
                      </p>
                    )}

                    {opened.status === "APPROVED" && opened.photoKey && (
                      <div className="ml-auto flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                          disabled={busy}
                          onClick={() => share([opened])}
                        >
                          <Share2 className="size-4" /> WhatsApp
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={busy}
                          onClick={() => download([opened])}
                        >
                          <Download className="size-4" /> Baixar
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
