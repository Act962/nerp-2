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
import { Check, Clock, MapPin, RotateCcw, User, X } from "lucide-react";
import { useState } from "react";
import {
  type PromotorPhotoStatus,
  usePhotosForApproval,
  useReviewPromotorPhoto,
} from "../hooks/use-promotor";

const FILTERS: { value: PromotorPhotoStatus; label: string }[] = [
  { value: "PENDING", label: "Pendentes" },
  { value: "APPROVED", label: "Aprovadas" },
  { value: "REJECTED", label: "Reprovadas" },
  { value: "ALL", label: "Todas" },
];

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

interface PhotosForApprovalListProps {
  // Controlado pelo dashboard: cada card de foto abre a lista já no seu status.
  status: PromotorPhotoStatus;
  onStatusChange: (status: PromotorPhotoStatus) => void;
}

// Lista de fotos para a coordenadora aprovar. A visibilidade e o gate de
// permissão ficam no dashboard (os cards de fotos).
export function PhotosForApprovalList({
  status: filter,
  onStatusChange: setFilter,
}: PhotosForApprovalListProps) {
  const { photos, isLoading, error, refetch } = usePhotosForApproval(filter);
  const review = useReviewPromotorPhoto();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  return (
    <div className="space-y-4 rounded-xl border p-4">
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

      {isLoading ? (
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
      ) : photos.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma foto nesta lista.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="overflow-hidden rounded-lg border">
              <a
                href={photo.photoKey ? constructUrl(photo.photoKey) : "#"}
                target="_blank"
                rel="noreferrer"
                className="block aspect-video bg-neutral-100"
              >
                {photo.photoKey && (
                  // biome-ignore lint/performance/noImgElement: thumbnail de key do R2
                  <img
                    src={constructUrl(photo.photoKey)}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                )}
              </a>
              <div className="space-y-1 p-2 text-xs">
                <p className="flex items-center gap-1 font-medium">
                  <User className="size-3" /> {photo.promoterName ?? "—"}
                </p>
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="size-3" /> {formatDate(photo.capturedAt)}
                </p>
                {(photo.capturedCity || photo.capturedState) && (
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3" />
                    {[photo.capturedCity, photo.capturedState]
                      .filter(Boolean)
                      .join("/")}
                  </p>
                )}
                <p className="text-muted-foreground">
                  {photo.storeName}
                  {photo.supplierName ? ` · ${photo.supplierName}` : ""}
                </p>
                {photo.approvalStatus === "REJECTED" && photo.approvalNote && (
                  <p className="rounded bg-red-50 px-1.5 py-1 text-red-700">
                    Motivo: {photo.approvalNote}
                  </p>
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
          ))}
        </div>
      )}
    </div>
  );
}
