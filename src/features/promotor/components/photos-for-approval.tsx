"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { constructUrl } from "@/hooks/use-construct-url";
import { compressImage } from "@/lib/compress-image";
import { uploadToR2 } from "@/lib/upload-to-r2";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Factory,
  MapPin,
  RotateCcw,
  Stamp,
  Store as StoreIcon,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  type ApprovalGroupBy,
  type PromotorPhotoStatus,
  useApplySeal,
  useApprovalGroups,
  usePhotosForApproval,
  useReviewPromotorPhoto,
  useReviewPromotorPhotosBulk,
} from "../hooks/use-promotor";
import { applySealToPhoto } from "../lib/bake-photo";
import {
  type DateRange,
  DateRangeFilter,
  rangeToInstants,
} from "./date-range-filter";

const FILTERS: { value: PromotorPhotoStatus; label: string }[] = [
  { value: "PENDING", label: "Pendentes" },
  { value: "APPROVED", label: "Aprovadas" },
  { value: "REJECTED", label: "Reprovadas" },
  { value: "ALL", label: "Todas" },
];

// Como a fila é organizada no topo. "store" mantém o drill loja→indústria;
// "promoter" e "supplier" têm um nível só; "photo" é a grade plana com ação
// em massa.
type ViewMode = ApprovalGroupBy | "photo";

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "store", label: "Por loja" },
  { value: "promoter", label: "Por promotor" },
  { value: "supplier", label: "Por indústria" },
  { value: "photo", label: "Por foto" },
];

type ApprovalPhoto = ReturnType<typeof usePhotosForApproval>["photos"][number];

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(iso),
  );
}

interface PhotosForApprovalListProps {
  // Controlado pelo dashboard: cada card de foto abre a lista já no seu status.
  status: PromotorPhotoStatus;
  onStatusChange: (status: PromotorPhotoStatus) => void;
}

/**
 * Fila de aprovação. Um seletor "Ver por" troca a organização: por loja (drill
 * loja→indústria→fotos), por promotor, por indústria (nível único → fotos) ou
 * por foto (grade plana com seleção em massa). Status e período valem em todos.
 */
export function PhotosForApprovalList({
  status: filter,
  onStatusChange: setFilter,
}: PhotosForApprovalListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("store");
  // Drill do modo "por loja": loja → indústria.
  const [store, setStore] = useState<{ id: string; name: string } | null>(null);
  const [supplier, setSupplier] = useState<{
    id: string | null;
    name: string;
  } | null>(null);
  // Drill de nível único (promotor ou indústria).
  const [drill, setDrill] = useState<{
    id: string | null;
    name: string;
  } | null>(null);
  const [range, setRange] = useState<DateRange>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const dates = rangeToInstants(range);

  // Estamos vendo fotos (vs. a lista de grupos)?
  const showingPhotos =
    viewMode === "photo" ||
    (viewMode === "store" && store !== null && supplier !== null) ||
    ((viewMode === "promoter" || viewMode === "supplier") && drill !== null);

  const clearNav = () => {
    setStore(null);
    setSupplier(null);
    setDrill(null);
    setSelected(new Set());
  };

  const changeMode = (mode: ViewMode) => {
    setViewMode(mode);
    clearNav();
  };

  const groupBy: ApprovalGroupBy = viewMode === "photo" ? "store" : viewMode;

  const { groups, isLoading: loadingGroups } = useApprovalGroups(
    filter,
    viewMode === "store" ? (store?.id ?? undefined) : undefined,
    // showingPhotos já cobre o modo "photo" (sempre true nele), então basta
    // negá-lo: em photo/drill não buscamos grupos.
    !showingPhotos,
    dates,
    groupBy,
  );

  const photoScope =
    viewMode === "store"
      ? { storeId: store?.id, supplierId: supplier?.id, ...dates }
      : viewMode === "promoter"
        ? { promoterName: drill?.id ?? undefined, ...dates }
        : viewMode === "supplier"
          ? { supplierId: drill?.id, ...dates }
          : { ...dates };

  const { photos, counts, isLoading, error, refetch } = usePhotosForApproval(
    filter,
    photoScope,
    showingPhotos,
  );

  // Total real do filtro atual (a query traz no máx. 120): serve pra avisar
  // quando "Selecionar todas" cobre só a página carregada, não o conjunto todo.
  const totalMatching =
    filter === "ALL"
      ? counts.pending + counts.approved + counts.rejected
      : filter === "APPROVED"
        ? counts.approved
        : filter === "REJECTED"
          ? counts.rejected
          : counts.pending;
  const truncated = photos.length < totalMatching;

  const review = useReviewPromotorPhoto();
  const reviewBulk = useReviewPromotorPhotosBulk();
  const applySeal = useApplySeal();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [sealingId, setSealingId] = useState<string | null>(null);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectNote, setBulkRejectNote] = useState("");

  const selectable = viewMode === "photo";
  const allSelected = photos.length > 0 && selected.size === photos.length;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(photos.map((p) => p.id)));
  };

  const runBulk = (status: "APPROVED" | "REJECTED", note?: string | null) => {
    reviewBulk.mutate(
      { photoIds: [...selected], status, note: note ?? null },
      { onSuccess: () => setSelected(new Set()) },
    );
  };

  // Compõe no navegador de quem aprova e manda só a chave nova: reaproveita o
  // mesmo canvas da captura, em vez de uma segunda implementação do carimbo no
  // servidor que poderia divergir dela.
  const stampPhoto = async (
    photoId: string,
    photoKey: string,
    codigoKey: string,
    approve: boolean,
  ) => {
    setSealingId(photoId);
    try {
      const blob = await applySealToPhoto({ photoKey, codigoKey });
      const file = new File([blob], `selo-${photoId}.jpg`, {
        type: "image/jpeg",
      });
      const key = await uploadToR2(await compressImage(file), true);
      applySeal.mutate({ photoId, photoKey: key, approve });
    } catch {
      toast.error("Não foi possível aplicar a senha do mês nesta foto");
    } finally {
      setSealingId(null);
    }
  };

  const goBack = () => {
    if (viewMode === "store") {
      if (supplier) {
        setSupplier(null);
        return;
      }
      setStore(null);
      return;
    }
    setDrill(null);
    setSelected(new Set());
  };

  // Rótulo do cabeçalho quando navegando dentro de um grupo.
  const navLabel =
    viewMode === "store"
      ? store
        ? { title: store.name, sub: supplier?.name ?? null }
        : null
      : drill
        ? { title: drill.name, sub: null }
        : null;

  const openGroup = (group: { id: string | null; name: string }) => {
    if (viewMode === "store") {
      if (store) setSupplier({ id: group.id, name: group.name });
      else if (group.id) setStore({ id: group.id, name: group.name });
    } else {
      setDrill(group);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border p-4">
      {/* Ver por: organização da fila. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-medium text-muted-foreground">
          Ver por:
        </span>
        {VIEW_MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            onClick={() => changeMode(mode.value)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              viewMode === mode.value
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {navLabel && (
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
              {navLabel.title}
            </p>
            {navLabel.sub && (
              <p className="truncate text-xs text-muted-foreground">
                {navLabel.sub}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setFilter(option.value);
              setSelected(new Set());
            }}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              filter === option.value
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <DateRangeFilter
        value={range}
        onChange={(next) => {
          // Muda o conjunto visível → a seleção antiga não corresponde mais ao
          // que está na tela; limpa pra não aprovar/reprovar fotos ocultas.
          setRange(next);
          setSelected(new Set());
        }}
      />

      {/* Barra de seleção em massa (só na visão "Por foto"). */}
      {selectable && photos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
              aria-label="Selecionar todas"
            />
            <button
              type="button"
              onClick={toggleSelectAll}
              className="cursor-pointer"
            >
              Selecionar todas
              {truncated ? ` (${photos.length} carregadas)` : ""}
            </button>
          </div>
          <span className="text-sm text-muted-foreground">
            {selected.size} selecionada(s)
          </span>
          {truncated && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
              Mostrando {photos.length} de {totalMatching} — refine o período
              para agir sobre o restante
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="gap-1 bg-emerald-600 hover:bg-emerald-700"
              disabled={selected.size === 0 || reviewBulk.isPending}
              onClick={() => runBulk("APPROVED")}
            >
              <Check className="size-3.5" /> Aprovar selecionadas
            </Button>
            <Popover open={bulkRejectOpen} onOpenChange={setBulkRejectOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1 border-red-200 text-red-700 hover:bg-red-100"
                  disabled={selected.size === 0 || reviewBulk.isPending}
                >
                  <X className="size-3.5" /> Reprovar selecionadas
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-60 space-y-2">
                <p className="text-xs font-medium">Motivo (opcional)</p>
                <Textarea
                  value={bulkRejectNote}
                  onChange={(event) => setBulkRejectNote(event.target.value)}
                  rows={3}
                  placeholder="Aplica-se a todas as selecionadas"
                  className="text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={reviewBulk.isPending}
                  onClick={() => {
                    runBulk("REJECTED", bulkRejectNote.trim() || null);
                    setBulkRejectOpen(false);
                    setBulkRejectNote("");
                  }}
                >
                  Confirmar reprovação
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      {(!showingPhotos && loadingGroups) || (showingPhotos && isLoading) ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : error ? (
        <div className="space-y-2 py-8 text-center">
          <p className="text-sm text-red-600">
            Não foi possível carregar as fotos: {error.message}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => refetch()}
          >
            Tentar de novo
          </Button>
        </div>
      ) : !showingPhotos ? (
        groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma foto nesta lista.
          </p>
        ) : (
          <ul className="rounded-md border">
            {groups.map((group) => (
              <li key={group.id ?? "sem"} className="border-b last:border-0">
                <button
                  type="button"
                  onClick={() => openGroup(group)}
                  className="flex w-full items-center gap-2 px-3 py-3 text-left hover:bg-accent"
                >
                  {viewMode === "promoter" ? (
                    <User className="size-5 shrink-0 text-muted-foreground" />
                  ) : viewMode === "supplier" ||
                    (viewMode === "store" && store) ? (
                    <Factory className="size-5 shrink-0 text-muted-foreground" />
                  ) : (
                    <StoreIcon className="size-5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{group.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {group.total} foto{group.total === 1 ? "" : "s"}
                      {group.lastCapturedAt &&
                        ` · última em ${formatDate(group.lastCapturedAt)}`}
                    </p>
                  </div>
                  {group.sealMissing > 0 && (
                    <Badge
                      variant="outline"
                      className="shrink-0 gap-1 border-amber-300 text-amber-700"
                    >
                      <Stamp className="size-3" /> {group.sealMissing}
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
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma foto nesta lista.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              selectable={selectable}
              selected={selected.has(photo.id)}
              onToggleSelect={() => toggleSelect(photo.id)}
              review={review}
              rejectId={rejectId}
              setRejectId={setRejectId}
              rejectNote={rejectNote}
              setRejectNote={setRejectNote}
              stampPhoto={stampPhoto}
              sealingId={sealingId}
              applySealPending={applySeal.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoCard({
  photo,
  selectable,
  selected,
  onToggleSelect,
  review,
  rejectId,
  setRejectId,
  rejectNote,
  setRejectNote,
  stampPhoto,
  sealingId,
  applySealPending,
}: {
  photo: ApprovalPhoto;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  review: ReturnType<typeof useReviewPromotorPhoto>;
  rejectId: string | null;
  setRejectId: (id: string | null) => void;
  rejectNote: string;
  setRejectNote: (note: string) => void;
  stampPhoto: (
    photoId: string,
    photoKey: string,
    codigoKey: string,
    approve: boolean,
  ) => void;
  sealingId: string | null;
  applySealPending: boolean;
}) {
  const canStamp =
    photo.sealMissing && !!photo.photoKey && !!photo.supplierActionCodeImage;
  const stamping = sealingId === photo.id || applySealPending;

  return (
    <div
      className={`overflow-hidden rounded-lg border ${
        selected ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="relative">
        {selectable && (
          <div className="absolute left-2 top-2 z-10 flex size-6 items-center justify-center rounded bg-black/50">
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              aria-label="Selecionar foto"
              className="border-white bg-white/90"
            />
          </div>
        )}
        <a
          href={photo.photoKey ? constructUrl(photo.photoKey) : "#"}
          target="_blank"
          rel="noreferrer"
          className="block aspect-video bg-neutral-900"
        >
          {photo.photoKey && (
            // `object-contain`, nunca `cover`: foto de celular vem em retrato e
            // o corte para 16:9 escondia o selo e o rodapé — exatamente o que
            // quem aprova precisa ver.
            // biome-ignore lint/performance/noImgElement: thumbnail de key do R2
            <img
              src={constructUrl(photo.photoKey)}
              alt=""
              loading="lazy"
              className="size-full object-contain"
            />
          )}
        </a>
      </div>
      <div className="space-y-1 p-2 text-xs">
        <p className="flex items-center gap-1 font-medium">
          <User className="size-3" /> {photo.promoterName ?? "—"}
        </p>
        <p className="flex items-center gap-1 text-muted-foreground">
          <Factory className="size-3" /> {photo.supplierName ?? "—"} ·{" "}
          {photo.storeName}
        </p>
        <p className="flex items-center gap-1 text-muted-foreground">
          <Clock className="size-3" /> {formatDateTime(photo.capturedAt)}
        </p>
        {(photo.capturedCity || photo.capturedState) && (
          <p className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="size-3" />
            {[photo.capturedCity, photo.capturedState]
              .filter(Boolean)
              .join("/")}
          </p>
        )}
        {photo.offSite && (
          <p className="flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-1 font-medium text-amber-900">
            <AlertTriangle className="size-3" /> Foto fora do local da loja
          </p>
        )}
        {photo.approvalStatus === "REJECTED" && photo.approvalNote && (
          <p className="rounded bg-red-50 px-1.5 py-1 text-red-700">
            Motivo: {photo.approvalNote}
          </p>
        )}

        {/* Foto salva sem selo: aplicar aqui evita reprovar e mandar o promotor
          refazer uma visita que já foi feita direito. */}
        {photo.sealMissing && (
          <div className="space-y-1.5 rounded border border-amber-300 bg-amber-50 p-1.5 text-amber-900">
            <p className="font-medium">Enviada sem a senha do mês</p>
            {canStamp ? (
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 flex-1 gap-1 text-xs"
                  disabled={stamping}
                  onClick={() =>
                    stampPhoto(
                      photo.id,
                      photo.photoKey as string,
                      photo.supplierActionCodeImage as string,
                      false,
                    )
                  }
                >
                  {stamping ? <Spinner /> : <Stamp className="size-3" />}
                  Aplicar senha
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 flex-1 gap-1 bg-emerald-600 text-xs hover:bg-emerald-700"
                  disabled={stamping}
                  onClick={() =>
                    stampPhoto(
                      photo.id,
                      photo.photoKey as string,
                      photo.supplierActionCodeImage as string,
                      true,
                    )
                  }
                >
                  <Check className="size-3" /> Senha + aprovar
                </Button>
              </div>
            ) : (
              <p>
                Esta indústria não tem senha do mês cadastrada — suba a imagem
                em Fornecedores para poder aplicar.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 pt-1">
          {photo.approvalStatus === "PENDING" ? (
            <>
              <Popover
                open={rejectId === photo.id}
                onOpenChange={(value) => {
                  setRejectId(value ? photo.id : null);
                  setRejectNote("");
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 flex-1 gap-1 border-red-200 text-red-700 hover:bg-red-100"
                  >
                    <X className="size-3.5" /> Reprovar
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-60 space-y-2">
                  <p className="text-xs font-medium">Motivo (opcional)</p>
                  <Textarea
                    value={rejectNote}
                    onChange={(event) => setRejectNote(event.target.value)}
                    rows={3}
                    placeholder="Ex.: código errado, foto escura…"
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    disabled={review.isPending}
                    onClick={() => {
                      review.mutate({
                        photoId: photo.id,
                        status: "REJECTED",
                        note: rejectNote.trim() || null,
                      });
                      setRejectId(null);
                    }}
                  >
                    Confirmar reprovação
                  </Button>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                size="sm"
                className="h-8 flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={review.isPending}
                onClick={() =>
                  review.mutate({ photoId: photo.id, status: "APPROVED" })
                }
              >
                <Check className="size-3.5" /> Aprovar
              </Button>
            </>
          ) : (
            <div className="flex w-full items-center justify-between">
              <Badge
                variant={
                  photo.approvalStatus === "APPROVED"
                    ? "default"
                    : "destructive"
                }
                className={
                  photo.approvalStatus === "APPROVED"
                    ? "gap-1 bg-emerald-600"
                    : "gap-1"
                }
              >
                {photo.approvalStatus === "APPROVED" ? (
                  <>
                    <Check className="size-3" /> Aprovada
                  </>
                ) : (
                  <>
                    <X className="size-3" /> Reprovada
                  </>
                )}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs"
                disabled={review.isPending}
                onClick={() =>
                  review.mutate({ photoId: photo.id, status: "PENDING" })
                }
              >
                <RotateCcw className="size-3" /> Reabrir
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
