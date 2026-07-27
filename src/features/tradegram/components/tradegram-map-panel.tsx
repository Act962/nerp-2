"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSceneStore } from "@/features/store-map/engine/scene-store";
import {
  SPACE_FLOW_LABELS,
  SPACE_STATE_META,
  SPACE_TIER_LABELS,
  SPACE_VISIBILITY_LABELS,
  isNegotiable,
} from "@/features/store-map/engine/space-state";
import type { MapObjectType } from "@/features/store-map/engine/types";
import { Clock, Handshake } from "lucide-react";
import type { InterestTarget } from "./tradegram-map";

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

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-muted-foreground text-xs">{label}</span>
      <span className="text-right font-medium text-sm">{value}</span>
    </div>
  );
}

interface TradegramMapPanelProps {
  mediaTypes: { id: string; name: string }[];
  sectors: { id: string; name: string }[];
  // O dialog de interesse vive no nível do mapa (fora do Sheet mobile). O painel
  // só dispara o alvo; quem renderiza o dialog é o TradeGramMap.
  onInterest: (target: InterestTarget) => void;
}

// Painel de info do mapa público (read-only): mostra só o que é público —
// tipo de mídia, setor, classificação e estado. Nunca indústria, marca, valor
// de negociação nem rastreabilidade (esses nem chegam do servidor). O CTA de
// interesse/fila captura o lead DENTRO da plataforma (anti-desintermediação).
export function TradegramMapPanel({
  mediaTypes,
  sectors,
  onInterest,
}: TradegramMapPanelProps) {
  const selectedIds = useSceneStore((state) => state.selectedIds);
  const objects = useSceneStore((state) => state.objects);

  const object = selectedIds.length === 1 ? objects[selectedIds[0]] : undefined;

  if (!object) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        Toque em um elemento do mapa (ou use a busca) para ver as informações.
      </div>
    );
  }

  const mediaTypeName =
    mediaTypes.find((media) => media.id === object.mediaTypeId)?.name ?? null;
  const sectorName =
    sectors.find((sector) => sector.id === object.sectorId)?.name ??
    object.category;
  const negotiable = isNegotiable(object);
  const stateMeta = SPACE_STATE_META[object.spaceState];
  const isFree = object.spaceState === "LIVRE";
  const interestKind = isFree ? "INTERESSE" : "FILA_ESPERA";
  const spaceLabel = mediaTypeName ?? TYPE_LABELS[object.type];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold leading-tight">
          Informações {mediaTypeName ?? "do espaço"}
        </h2>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant="secondary">{TYPE_LABELS[object.type]}</Badge>
          {negotiable && (
            <span
              className="rounded-full px-2 py-0.5 font-semibold text-xs"
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
        <InfoRow label="Tipo de mídia" value={mediaTypeName} />
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
            object.visibility
              ? SPACE_VISIBILITY_LABELS[object.visibility]
              : null
          }
        />
      </div>

      {negotiable && (
        <Button
          className="w-full"
          onClick={() =>
            onInterest({
              mapObjectId: object.id,
              kind: interestKind,
              spaceCode: object.spaceCode,
              spaceLabel,
            })
          }
        >
          {isFree ? (
            <>
              <Handshake className="size-4" /> Tenho interesse neste ponto
            </>
          ) : (
            <>
              <Clock className="size-4" /> Entrar na fila de espera
            </>
          )}
        </Button>
      )}
    </div>
  );
}
