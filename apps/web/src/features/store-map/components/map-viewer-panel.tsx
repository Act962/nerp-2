"use client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useBrands } from "@/features/brands/hooks/use-brands";
import { PdvPhotoSection } from "@/features/pdv-photos/components/pdv-photo-section";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import { useMediaModelPhotos } from "@/features/trade-catalog/hooks/use-media-model-photos";
import {
  useMediaTypes,
  useStoreSectors,
} from "@/features/trade-catalog/hooks/use-trade-catalog";
import { constructUrl } from "@/hooks/use-construct-url";
import { ImageIcon, UserCog } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { readNegotiation } from "../engine/negotiation";
import { useSceneStore } from "../engine/scene-store";
import {
  isNegotiable,
  SPACE_FLOW_LABELS,
  SPACE_STATE_META,
  SPACE_TIER_LABELS,
  SPACE_VISIBILITY_LABELS,
} from "../engine/space-state";
import type { MapObjectType } from "../engine/types";
import { useMapObjectAudit } from "../hooks/use-map-object-audit";

const TYPE_LABELS: Record<MapObjectType, string> = {
  WALL: "Parede",
  AISLE: "Corredor",
  SECTOR: "Setor",
  GONDOLA: "Gôndola",
  ISLAND: "Ilha",
  CHECKOUT: "Caixa",
  ENTRANCE: "Entrada",
  EXIT: "Saída",
  DEPOSIT: "Depósito",
  RESTRICTED_AREA: "Área restrita",
  PIN: "Pin",
  TEXT: "Texto",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Sem visita registrada";
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

interface InfoRowProps {
  label: string;
  value: string | null | undefined;
}

/** Linha somente-leitura: o promotor consulta, quem edita é o admin no editor. */
function InfoRow({ label, value }: InfoRowProps) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

interface MapViewerPanelProps {
  storeName?: string;
}

export function MapViewerPanel({ storeName }: MapViewerPanelProps) {
  const selectedIds = useSceneStore((state) => state.selectedIds);
  const objects = useSceneStore((state) => state.objects);
  const storeId = useSceneStore((state) => state.floorPlan?.storeId);

  const object = selectedIds.length === 1 ? objects[selectedIds[0]] : undefined;
  const { suppliers } = useSupplier({ pageSize: 100 });
  const { brands } = useBrands(object?.supplierId ?? undefined);
  const { audit } = useMapObjectAudit(object?.id);
  const { mediaTypes } = useMediaTypes();
  const { storeSectors } = useStoreSectors();
  const { photos: globalPhotos } = useMediaModelPhotos();
  const [showModelPhotos, setShowModelPhotos] = useState(false);

  if (!object) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Toque em um elemento do mapa (ou use a busca) para ver as informações e
        registrar as fotos.
      </div>
    );
  }

  const negotiation = readNegotiation(object.properties);
  const supplierName =
    suppliers.find((supplier) => supplier.id === object.supplierId)?.name ??
    null;
  const brandName =
    brands.find((brand) => brand.id === object.brandId)?.name ?? null;
  const mediaType = mediaTypes.find(
    (candidate) => candidate.id === object.mediaTypeId,
  );
  const mediaTypeName = mediaType?.name ?? null;
  // Biblioteca global do Órbita (por código) + fotos da própria org.
  const modelPhotos = [
    ...globalPhotos
      .filter((photo) => photo.code === mediaType?.code)
      .map((photo) => photo.imageKey),
    ...(mediaType?.defaultPhotos ?? []),
  ];
  const sector = storeSectors.find((sector) => sector.id === object.sectorId);
  const sectorName = sector?.name ?? object.category;

  const start = formatDate(negotiation.negotiationStart);
  const end = formatDate(negotiation.negotiationEnd);
  const period = start && end ? `${start} a ${end}` : (start ?? end);

  const negotiable = isNegotiable(object);
  const stateMeta = SPACE_STATE_META[object.spaceState];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {modelPhotos.length > 0 && (
            <button
              type="button"
              onClick={() => setShowModelPhotos(true)}
              className="relative size-9 shrink-0 overflow-hidden rounded-md border"
              title="Ver foto modelo"
            >
              <Image
                src={constructUrl(modelPhotos[0])}
                alt={mediaTypeName ?? "Foto modelo"}
                fill
                sizes="36px"
                className="object-cover"
              />
            </button>
          )}
          <div>
            <h2 className="font-semibold leading-tight">
              Informações {mediaTypeName ?? "da Prateleira"}
            </h2>
            {storeName && (
              <p className="text-xs text-muted-foreground">{storeName}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant="secondary">{TYPE_LABELS[object.type]}</Badge>
          {negotiable && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: stateMeta.fill,
                color: stateMeta.stroke,
              }}
            >
              {stateMeta.dot} {stateMeta.label}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <InfoRow label="Elemento" value={object.name} />
        <InfoRow label="ID do espaço" value={object.spaceCode} />
        <InfoRow label="Localização" value={negotiation.location} />
        {mediaTypeName && (
          <div className="flex items-baseline justify-between gap-3">
            <span className="shrink-0 text-xs text-muted-foreground">
              Tipo de mídia
            </span>
            <span className="flex items-center gap-1.5 text-right text-sm font-medium">
              {mediaTypeName}
              {modelPhotos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowModelPhotos(true)}
                  title="Ver foto modelo"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ImageIcon className="size-3.5" />
                </button>
              )}
            </span>
          </div>
        )}
        <InfoRow label="Descrição da mídia" value={mediaType?.description} />
        <InfoRow label="Setor" value={sectorName} />
        <InfoRow
          label="Categoria"
          value={object.tier ? SPACE_TIER_LABELS[object.tier] : null}
        />
        <InfoRow
          label="Fluxo"
          value={object.flowLevel ? SPACE_FLOW_LABELS[object.flowLevel] : null}
        />
        <InfoRow
          label="Visibilidade"
          value={
            object.visibility ? SPACE_VISIBILITY_LABELS[object.visibility] : null
          }
        />
        <InfoRow label="Indústria" value={supplierName} />
        <InfoRow label="Marca ocupante" value={brandName} />
        <InfoRow label="Distribuidor" value={negotiation.distributor} />
        <InfoRow label="Período" value={period} />
      </div>

      <div className="space-y-2 rounded-md bg-muted/50 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <UserCog className="size-3.5" />
          Rastreabilidade
        </div>
        <InfoRow
          label="Última visita"
          value={formatDateTime(audit?.lastVisitAt)}
        />
        <InfoRow label="Promotor" value={audit?.promoterName ?? "—"} />
        <InfoRow label="Supervisor" value={audit?.supervisorName ?? "—"} />
      </div>

      {storeId && (
        <>
          <Separator />
          <PdvPhotoSection
            storeId={storeId}
            mapObjectId={object.id}
            defaultSupplierId={object.supplierId}
            defaultSection={sectorName}
          />
        </>
      )}

      <Dialog open={showModelPhotos} onOpenChange={setShowModelPhotos}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Foto modelo · {mediaTypeName}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {modelPhotos.map((key) => (
              <div
                key={key}
                className="relative aspect-square overflow-hidden rounded-md border"
              >
                <Image
                  src={constructUrl(key)}
                  alt={mediaTypeName ?? "Foto modelo"}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
          {mediaType?.occupancyRules && (
            <p className="text-sm text-muted-foreground">
              {mediaType.occupancyRules}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
