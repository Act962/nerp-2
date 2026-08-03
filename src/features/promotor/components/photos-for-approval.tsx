"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  type PromotorPhotoStatus,
  useApplySeal,
  useApprovalGroups,
  usePhotosForApproval,
  useReviewPromotorPhoto,
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
 * Fila de aprovação, organizada como o "Minhas fotos" do promotor: cliente →
 * indústria → fotos. A coordenadora revisa por visita, não numa grade única de
 * tudo que chegou — com vários promotores em campo, a grade cresce sem limite
 * e não dá para saber se a loja X foi coberta.
 */
export function PhotosForApprovalList({
  status: filter,
  onStatusChange: setFilter,
}: PhotosForApprovalListProps) {
  const [store, setStore] = useState<{ id: string; name: string } | null>(null);
  const [supplier, setSupplier] = useState<{
    id: string | null;
    name: string;
  } | null>(null);
  const [range, setRange] = useState<DateRange>({});
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [sealingId, setSealingId] = useState<string | null>(null);

  const atPhotos = store !== null && supplier !== null;
  const dates = rangeToInstants(range);

  const { groups, isLoading: loadingGroups } = useApprovalGroups(
    filter,
    store?.id,
    !atPhotos,
    dates,
  );
  const { photos, isLoading, error, refetch } = usePhotosForApproval(
    filter,
    { storeId: store?.id, supplierId: supplier?.id, ...dates },
    atPhotos,
  );

  const review = useReviewPromotorPhoto();
  const applySeal = useApplySeal();

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
    if (supplier) {
      setSupplier(null);
      return;
    }
    setStore(null);
  };

  return (
    <div className="space-y-4 rounded-xl border p-4">
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
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
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

      <DateRangeFilter value={range} onChange={setRange} />

      {(!atPhotos && loadingGroups) || (atPhotos && isLoading) ? (
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
      ) : !atPhotos ? (
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
                  onClick={() => {
                    if (store) setSupplier({ id: group.id, name: group.name });
                    else if (group.id)
                      setStore({ id: group.id, name: group.name });
                  }}
                  className="flex w-full items-center gap-2 px-3 py-3 text-left hover:bg-accent"
                >
                  {store ? (
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
          {photos.map((photo) => {
            const canStamp =
              photo.sealMissing &&
              !!photo.photoKey &&
              !!photo.supplierActionCodeImage;
            const stamping = sealingId === photo.id || applySeal.isPending;

            return (
              <div key={photo.id} className="overflow-hidden rounded-lg border">
                <a
                  href={photo.photoKey ? constructUrl(photo.photoKey) : "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-video bg-neutral-900"
                >
                  {photo.photoKey && (
                    // `object-contain`, nunca `cover`: foto de celular vem em
                    // retrato e o corte para 16:9 escondia as pontas — só os 42%
                    // centrais apareciam. O selo e o texto do rodapé, ou seja,
                    // exatamente o que era cortado. Quem aprova precisa ver isso.
                    // biome-ignore lint/performance/noImgElement: thumbnail de key do R2
                    <img
                      src={constructUrl(photo.photoKey)}
                      alt=""
                      loading="lazy"
                      className="size-full object-contain"
                    />
                  )}
                </a>
                <div className="space-y-1 p-2 text-xs">
                  <p className="flex items-center gap-1 font-medium">
                    <User className="size-3" /> {photo.promoterName ?? "—"}
                  </p>
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3" />{" "}
                    {formatDateTime(photo.capturedAt)}
                  </p>
                  {(photo.capturedCity || photo.capturedState) && (
                    <p className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="size-3" />
                      {[photo.capturedCity, photo.capturedState]
                        .filter(Boolean)
                        .join("/")}
                    </p>
                  )}
                  {photo.approvalStatus === "REJECTED" &&
                    photo.approvalNote && (
                      <p className="rounded bg-red-50 px-1.5 py-1 text-red-700">
                        Motivo: {photo.approvalNote}
                      </p>
                    )}

                  {/* Foto salva sem selo: aplicar aqui evita reprovar e mandar
                    o promotor refazer uma visita que já foi feita direito. */}
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
                            {stamping ? (
                              <Spinner />
                            ) : (
                              <Stamp className="size-3" />
                            )}
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
                          Esta indústria não tem senha do mês cadastrada — suba
                          a imagem em Fornecedores para poder aplicar.
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
                          <PopoverContent
                            align="start"
                            className="w-60 space-y-2"
                          >
                            <p className="text-xs font-medium">
                              Motivo (opcional)
                            </p>
                            <Textarea
                              value={rejectNote}
                              onChange={(event) =>
                                setRejectNote(event.target.value)
                              }
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
                            review.mutate({
                              photoId: photo.id,
                              status: "APPROVED",
                            })
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
                            review.mutate({
                              photoId: photo.id,
                              status: "PENDING",
                            })
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
          })}
        </div>
      )}
    </div>
  );
}
