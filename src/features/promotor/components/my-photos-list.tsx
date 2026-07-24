"use client";

import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import { Check, Clock, MapPin, X } from "lucide-react";
import { useState } from "react";
import { type PromotorPhotoStatus, useMyPhotos } from "../hooks/use-promotor";

const FILTERS: { value: PromotorPhotoStatus; label: string }[] = [
  { value: "ALL", label: "Todas" },
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

export function MyPhotosList() {
  const [filter, setFilter] = useState<PromotorPhotoStatus>("ALL");
  const { photos, counts, isLoading } = useMyPhotos(filter);

  const countFor = (value: PromotorPhotoStatus) =>
    value === "ALL"
      ? counts.all
      : value === "APPROVED"
        ? counts.approved
        : value === "REJECTED"
          ? counts.rejected
          : counts.pending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((option) => {
          const active = filter === option.value;
          const showRejected =
            option.value === "REJECTED" && counts.rejected > 0;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              {option.label}
              <span
                className={`rounded-full px-1.5 text-xs font-semibold ${
                  showRejected && !active
                    ? "bg-red-600 text-white"
                    : active
                      ? "bg-primary-foreground/20"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {countFor(option.value)}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : photos.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma foto nesta lista.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="overflow-hidden rounded-lg border bg-card"
            >
              <div className="aspect-square bg-neutral-100">
                {photo.photoKey && (
                  // biome-ignore lint/performance/noImgElement: thumbnail de key do R2
                  <img
                    src={constructUrl(photo.photoKey)}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                )}
              </div>
              <div className="space-y-1 p-2">
                <StatusBadge status={photo.status} />
                <p className="truncate text-xs font-medium">
                  {photo.storeName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {photo.supplierName ?? "—"}
                </p>
                {(photo.capturedCity || photo.capturedState) && (
                  <p className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                    <MapPin className="size-3" />
                    {[photo.capturedCity, photo.capturedState]
                      .filter(Boolean)
                      .join("/")}
                  </p>
                )}
                {photo.status === "REJECTED" && photo.rejectionNote && (
                  <p className="rounded bg-red-50 px-1.5 py-1 text-[11px] text-red-700">
                    Motivo: {photo.rejectionNote}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
