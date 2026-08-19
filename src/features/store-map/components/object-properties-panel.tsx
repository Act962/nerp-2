"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useBrands } from "@/features/brands/hooks/use-brands";
import { PdvPhotoSection } from "@/features/pdv-photos/components/pdv-photo-section";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import {
  useMediaTypes,
  useStoreSectors,
} from "@/features/trade-catalog/hooks/use-trade-catalog";
import {
  Boxes,
  CheckCircle2,
  CircleDashed,
  Handshake,
  Layers,
  Maximize2,
  Move,
  RefreshCw,
  RotateCw,
  Trash2,
} from "lucide-react";
import { constructUrl } from "@/hooks/use-construct-url";
import { areaOf } from "../engine/geometry";
import {
  readFixtureProps,
  toggleShelfIndex,
  withFixtureProps,
} from "../engine/fixture-catalog";
import {
  type NegotiationField,
  readNegotiation,
  withNegotiationField,
} from "../engine/negotiation";
import { useSceneStore } from "../engine/scene-store";
import {
  isNegotiable,
  SPACE_FLOW_LABELS,
  SPACE_FLOW_ORDER,
  SPACE_STATE_META,
  SPACE_STATE_ORDER,
  SPACE_TIER_LABELS,
  SPACE_TIER_ORDER,
  SPACE_VISIBILITY_LABELS,
  SPACE_VISIBILITY_ORDER,
} from "../engine/space-state";
import type {
  MapObjectType,
  SpaceFlowLevel,
  SpaceTier,
  SpaceVisibility,
} from "../engine/types";
import { useAssignSpaceCode } from "../hooks/use-assign-space-code";
import { useMapLayerMutations } from "../hooks/use-map-layers";
import { useUpdateSpaceParams } from "../hooks/use-update-space-params";

const NONE = "__none__";
const DEFAULT_LABEL_FONT_M = 0.4;

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

// Porta-palete no padrão do editor de planograma (mesmas medidas/cores em mm):
// montante azul perfurado, longarina laranja e sapata amarela.
const UPRIGHT_MM = 90;
const BEAM_MM = 120;
const FOOT_H_MM = 110;
const FOOT_W_MM = 150;
const SLOT_STEP_MM = 75;
const SLOT_W_MM = 22;
const SLOT_H_MM = 26;
const CONN_W_MM = 78;
const CONN_OVERHANG_MM = 45;
const UPRIGHT_HEX = "#20409a";
const UPRIGHT_SHADE = "#16306f";
const BEAM_HEX = "#e8621d";
const BEAM_SHADE = "#b44a15";
const FOOT_HEX = "#f2b705";
const FOOT_SHADE = "#c99400";

/**
 * Vista frontal da gôndola desenhada IGUAL ao editor de planograma (montantes
 * azuis perfurados + longarinas laranja + sapatas amarelas), com as `shelfCount`
 * prateleiras e os vãos vazios, prontos pra inserir produtos. Trabalha em mm
 * (como o engine) e escala pro tamanho pedido preservando a proporção real.
 */
function GondolaPreview({
  frontWidthM,
  heightM,
  shelfCount,
  negotiatedIndexes,
  maxW,
  maxH,
  onToggleShelf,
}: {
  frontWidthM: number;
  heightM: number;
  shelfCount: number;
  negotiatedIndexes: number[];
  maxW: number;
  maxH: number;
  onToggleShelf?: (shelfIndex: number) => void;
}) {
  const bayMm = Math.max(200, frontWidthM * 1000);
  const hMm = Math.max(400, heightM * 1000);
  const totalW = bayMm + UPRIGHT_MM * 2;
  const totalH = hMm + FOOT_H_MM;
  const aspect = totalW / totalH;
  let dW = maxW;
  let dH = maxW / aspect;
  if (dH > maxH) {
    dH = maxH;
    dW = maxH * aspect;
  }

  const shelves = Math.max(1, Math.round(shelfCount));
  const negSet = new Set(negotiatedIndexes);
  const interactive = Boolean(onToggleShelf);
  const rightX = totalW - UPRIGHT_MM;
  const bayX = UPRIGHT_MM;
  const slotX = (UPRIGHT_MM - SLOT_W_MM) / 2;
  const slotCount = Math.max(0, Math.floor(hMm / SLOT_STEP_MM) - 1);
  const beamTops = Array.from(
    { length: shelves },
    (_, i) => (hMm * (i + 1)) / (shelves + 1),
  );
  const dotR = Math.min(60, BEAM_MM * 0.42);

  const upright = (x: number) => (
    <g key={`up-${x}`}>
      <rect x={x} y={0} width={UPRIGHT_MM} height={hMm} fill={UPRIGHT_HEX} />
      <rect
        x={x + UPRIGHT_MM - 18}
        y={0}
        width={18}
        height={hMm}
        fill={UPRIGHT_SHADE}
      />
      {Array.from({ length: slotCount }, (_, i) => (
        <rect
          key={i}
          x={x + slotX}
          y={(i + 1) * SLOT_STEP_MM}
          width={SLOT_W_MM}
          height={SLOT_H_MM}
          rx={4}
          fill={UPRIGHT_SHADE}
        />
      ))}
      {/* Sapata amarela */}
      <rect
        x={x + (UPRIGHT_MM - FOOT_W_MM) / 2}
        y={hMm}
        width={FOOT_W_MM}
        height={FOOT_H_MM}
        rx={6}
        fill={FOOT_HEX}
      />
      <rect
        x={x + (UPRIGHT_MM - FOOT_W_MM) / 2}
        y={hMm}
        width={FOOT_W_MM}
        height={22}
        fill={FOOT_SHADE}
      />
    </g>
  );

  const beam = (topY: number, i: number) => {
    const y = topY - BEAM_MM;
    // i = índice da prateleira (0 = topo). Negociação é POR prateleira.
    const isNeg = negSet.has(i);
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: <g> SVG com role/tabIndex/teclado
      <g
        key={`beam-${i}`}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={
          interactive
            ? `Prateleira ${i + 1}${isNeg ? " (negociada)" : ""}`
            : undefined
        }
        onClick={interactive ? () => onToggleShelf?.(i) : undefined}
        onKeyDown={
          interactive
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onToggleShelf?.(i);
                }
              }
            : undefined
        }
        style={interactive ? { cursor: "pointer" } : undefined}
      >
        {/* Área de clique cobrindo toda a longarina */}
        {interactive && (
          <rect
            x={bayX}
            y={y - CONN_OVERHANG_MM}
            width={bayMm}
            height={BEAM_MM + CONN_OVERHANG_MM * 2}
            fill="transparent"
          />
        )}
        {/* Cantoneiras encavalando os montantes */}
        <rect
          x={bayX - CONN_W_MM}
          y={y - CONN_OVERHANG_MM}
          width={CONN_W_MM}
          height={BEAM_MM + CONN_OVERHANG_MM * 2}
          rx={5}
          fill={BEAM_HEX}
        />
        <rect
          x={bayX + bayMm}
          y={y - CONN_OVERHANG_MM}
          width={CONN_W_MM}
          height={BEAM_MM + CONN_OVERHANG_MM * 2}
          rx={5}
          fill={BEAM_HEX}
        />
        {/* Longarina */}
        <rect x={bayX} y={y} width={bayMm} height={BEAM_MM} fill={BEAM_HEX} />
        <rect x={bayX} y={y} width={bayMm} height={26} fill={BEAM_SHADE} />
        {/* Marcador de prateleira negociada (verde) ou não (cinza) */}
        <circle
          cx={bayX + dotR + 40}
          cy={y + BEAM_MM / 2}
          r={dotR}
          fill={isNeg ? "#16a34a" : "#e2e8f0"}
          stroke="#ffffff"
          strokeWidth={10}
        />
      </g>
    );
  };

  return (
    <svg
      width={Math.round(dW)}
      height={Math.round(dH)}
      viewBox={`0 0 ${totalW} ${totalH}`}
      role="img"
      aria-label="Vista frontal da gôndola"
    >
      {upright(0)}
      {upright(rightX)}
      {beamTops.map((t, i) => beam(t, i))}
    </svg>
  );
}

export function ObjectPropertiesPanel() {
  const selectedIds = useSceneStore((state) => state.selectedIds);
  const objects = useSceneStore((state) => state.objects);
  const updateObject = useSceneStore((state) => state.updateObject);
  const removeSelected = useSceneStore((state) => state.removeSelected);
  const setSelection = useSceneStore((state) => state.setSelection);
  const setTool = useSceneStore((state) => state.setTool);
  const rotateObjectsBy = useSceneStore((state) => state.rotateObjectsBy);
  const addLayer = useSceneStore((state) => state.addLayer);
  const setActiveLayer = useSceneStore((state) => state.setActiveLayer);
  const floorPlanId = useSceneStore((state) => state.floorPlan?.id);
  const storeId = useSceneStore((state) => state.floorPlan?.storeId);
  const { create: createLayer } = useMapLayerMutations();
  const [sectorName, setSectorName] = useState("");
  const [gondolaFull, setGondolaFull] = useState(false);

  // Cria um setor (camada) com o nome dado e move as gôndolas selecionadas pra
  // ele — cada uma mantém a própria config; só ficam agrupadas.
  const createSectorFromSelection = () => {
    const name = sectorName.trim();
    if (!name || selectedIds.length === 0 || !floorPlanId) return;
    const layer = addLayer(name);
    createLayer.mutate({
      id: layer.id,
      floorPlanId,
      name: layer.name,
      order: layer.order,
    });
    for (const id of selectedIds) {
      updateObject(id, { layerId: layer.id });
    }
    setActiveLayer(layer.id);
    setSectorName("");
    toast.success(`Setor "${name}" criado com ${selectedIds.length} gôndolas`);
  };

  const object = selectedIds.length === 1 ? objects[selectedIds[0]] : undefined;
  const { suppliers } = useSupplier({ pageSize: 100 });
  const { brands } = useBrands(object?.supplierId ?? undefined);
  const { storeSectors } = useStoreSectors();
  const { mediaTypes } = useMediaTypes();
  const assignSpaceCode = useAssignSpaceCode();
  const updateSpaceParams = useUpdateSpaceParams();

  if (selectedIds.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Selecione um objeto para editar suas propriedades.
      </div>
    );
  }

  if (selectedIds.length > 1) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-sm font-medium">
          {selectedIds.length} peças selecionadas
        </p>
        <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
          <Move className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            Arraste qualquer peça para mover a estrutura completa de uma vez.
          </p>
        </div>

        {/* Editor em massa: aplica a TODAS as gôndolas selecionadas. */}
        <div className="space-y-3 rounded-md border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Editar todas ({selectedIds.length})
          </p>
          <Field>
            <FieldLabel htmlFor="bulk-name">Nome</FieldLabel>
            <Input
              id="bulk-name"
              placeholder="Aplicar o mesmo nome a todas"
              onBlur={(event) => {
                const value = event.target.value;
                if (!value) return;
                for (const id of selectedIds) {
                  updateObject(id, { name: value });
                }
              }}
            />
          </Field>
          <Field>
            <FieldLabel>Indústria (logo na gôndola)</FieldLabel>
            <Select
              onValueChange={(value) => {
                const supplierId = value === NONE ? null : value;
                for (const id of selectedIds) {
                  updateObject(id, { supplierId, brandId: null });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Aplicar indústria a todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhuma (sem logo)</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>
              Tamanho do rótulo (
              {(
                objects[selectedIds[0]]?.style.fontSize ?? DEFAULT_LABEL_FONT_M
              ).toFixed(1)}{" "}
              m)
            </FieldLabel>
            <Slider
              value={[
                objects[selectedIds[0]]?.style.fontSize ?? DEFAULT_LABEL_FONT_M,
              ]}
              min={0.2}
              max={2}
              step={0.1}
              onValueChange={([value]) => {
                for (const id of selectedIds) {
                  const target = objects[id];
                  if (!target) continue;
                  updateObject(id, {
                    style: { ...target.style, fontSize: value },
                  });
                }
              }}
            />
          </Field>
        </div>

        {/* Agrupar as gôndolas num setor (camada) nomeado. */}
        <div className="space-y-2 rounded-md border p-3">
          <FieldLabel htmlFor="sector-name">Criar setor</FieldLabel>
          <Input
            id="sector-name"
            value={sectorName}
            placeholder="Ex.: Bebidas"
            onChange={(event) => setSectorName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") createSectorFromSelection();
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2"
            disabled={!sectorName.trim()}
            onClick={createSectorFromSelection}
          >
            <Layers className="size-4" />
            Agrupar {selectedIds.length} gôndolas no setor
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => rotateObjectsBy(selectedIds, 90)}
        >
          <RotateCw className="size-4" />
          Girar 90°
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={removeSelected}
        >
          <Trash2 className="size-4" />
          Excluir selecionadas
        </Button>
      </div>
    );
  }

  if (!object) return null;

  const size =
    object.geometry.kind === "RECT"
      ? `${object.geometry.width.toFixed(2)} × ${object.geometry.height.toFixed(2)} m`
      : null;

  const negotiation = readNegotiation(object.properties);

  const setNegotiation = (field: NegotiationField, value: string) =>
    updateObject(object.id, {
      properties: withNegotiationField(object, field, value),
    });

  const negotiable = isNegotiable(object);
  const labelFont = object.style.fontSize ?? DEFAULT_LABEL_FONT_M;
  const areaM2 = areaOf(object.geometry);
  const fixture = readFixtureProps(object.properties);

  // Vista frontal: largura da frente = lado do footprint no mapa; altura =
  // "Altura" do móvel (ou a elevação do preset); base do preset.
  const fixtureFrontM =
    object.geometry.kind === "RECT" ? object.geometry.width : 0;
  const fixtureElevationM =
    object.heightM && object.heightM > 0
      ? object.heightM
      : fixture
        ? fixture.heightMm / 1000
        : 0;

  // Indústria (logo + nome) e status de negociação da gôndola.
  const fixtureSupplier = object.supplierId
    ? suppliers.find((s) => s.id === object.supplierId)
    : undefined;
  const fixtureLogoUrl = fixtureSupplier?.logo
    ? constructUrl(fixtureSupplier.logo)
    : null;
  const negTotal = fixture ? Math.max(0, Math.round(fixture.shelfCount)) : 0;
  const negDone = fixture
    ? Math.min(Math.max(0, Math.round(fixture.negotiatedShelves)), negTotal)
    : 0;
  const negLevel =
    negTotal > 0 && negDone >= negTotal
      ? "full"
      : negDone > 0
        ? "partial"
        : "none";

  // Alterna a prateleira (índice, 0 = topo) no conjunto de negociadas. O
  // contador do badge no mapa segue `negotiatedShelves` = quantidade de índices.
  const toggleShelf = (shelfIndex: number) =>
    updateObject(object.id, {
      properties: withFixtureProps(object, {
        negotiatedShelfIndexes: toggleShelfIndex(
          fixture?.negotiatedShelfIndexes ?? [],
          shelfIndex,
        ),
      }),
    });

  // Peças do mesmo móvel (mesmo fixtureGroupId): permite selecionar o móvel
  // inteiro e movê-lo junto com o "mover estrutura".
  const groupId = fixture?.fixtureGroupId;
  const groupIds = groupId
    ? Object.values(objects)
        .filter(
          (item) =>
            readFixtureProps(item.properties)?.fixtureGroupId === groupId,
        )
        .map((item) => item.id)
    : [];
  const selectGroup = () => {
    if (groupIds.length === 0) return;
    setTool("SELECT");
    setSelection(groupIds);
  };

  const handleAssignCode = () => {
    assignSpaceCode.mutate(
      { mapObjectId: object.id },
      {
        onSuccess: (result) =>
          updateObject(object.id, {
            spaceCode: result.spaceCode,
            spaceSeq: result.spaceSeq,
          }),
      },
    );
  };

  // Biblioteca Nacional fica FORA do autosave (bulk-upsert não carrega esses
  // campos) — a mutation dedicada persiste, e sincronizamos o store local no
  // sucesso pro painel refletir na hora, igual o Space ID já faz.
  const saveSpaceParams = (
    patch: Partial<{
      mediaTypeId: string | null;
      sectorId: string | null;
      tier: SpaceTier | null;
      flowLevel: SpaceFlowLevel | null;
      visibility: SpaceVisibility | null;
      isExclusive: boolean;
      revenuePotential: number | null;
      avgSalesAmount: number | null;
    }>,
  ) => {
    updateSpaceParams.mutate(
      { id: object.id, ...patch },
      { onSuccess: () => updateObject(object.id, patch) },
    );
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
            {TYPE_LABELS[object.type]}
          </span>
          {size && (
            <span className="mt-1 text-xs text-muted-foreground">{size}</span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-destructive"
          title="Excluir"
          onClick={removeSelected}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {fixture && (
        <div className="relative flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1.5 top-1.5 size-7"
            title="Ver em tela cheia"
            onClick={() => setGondolaFull(true)}
          >
            <Maximize2 className="size-4" />
          </Button>

          {/* Indústria (logo + nome) + status de negociação */}
          <div className="flex items-center justify-between gap-2 pr-7">
            <div className="flex min-w-0 items-center gap-2">
              {fixtureLogoUrl ? (
                // biome-ignore lint/performance/noImgElement: logo simples do painel, sem otimização
                <img
                  src={fixtureLogoUrl}
                  alt=""
                  className="size-6 shrink-0 rounded object-contain"
                />
              ) : (
                <div className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                  —
                </div>
              )}
              <span className="truncate text-xs font-medium">
                {fixtureSupplier?.name ?? "Sem indústria"}
              </span>
            </div>
            {negLevel === "full" ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <CheckCircle2 className="size-3.5" />
                Negociado
              </span>
            ) : negLevel === "partial" ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <Handshake className="size-3.5" />
                {negDone}/{negTotal}
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <CircleDashed className="size-3.5" />
                Disponível
              </span>
            )}
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <GondolaPreview
              frontWidthM={fixtureFrontM}
              heightM={fixtureElevationM}
              shelfCount={fixture.shelfCount}
              negotiatedIndexes={fixture.negotiatedShelfIndexes}
              onToggleShelf={toggleShelf}
              maxW={232}
              maxH={188}
            />
            <span className="text-center text-xs text-muted-foreground">
              Frente {fixtureFrontM.toFixed(2)} m · Altura{" "}
              {fixtureElevationM.toFixed(2)} m · {fixture.shelfCount}{" "}
              prateleiras
              <br />
              Clique numa prateleira para negociá-la.
            </span>
          </div>

          <Dialog open={gondolaFull} onOpenChange={setGondolaFull}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {fixtureLogoUrl && (
                    // biome-ignore lint/performance/noImgElement: logo simples do diálogo
                    <img
                      src={fixtureLogoUrl}
                      alt=""
                      className="size-6 rounded object-contain"
                    />
                  )}
                  {object.name ?? "Gôndola"}
                  {fixtureSupplier?.name ? ` · ${fixtureSupplier.name}` : ""} —{" "}
                  {fixture.shelfCount} prateleiras ({negDone}/{negTotal}{" "}
                  negociadas)
                </DialogTitle>
              </DialogHeader>
              <div className="flex max-h-[75vh] justify-center overflow-auto p-2">
                <GondolaPreview
                  frontWidthM={fixtureFrontM}
                  heightM={fixtureElevationM}
                  shelfCount={fixture.shelfCount}
                  negotiatedIndexes={fixture.negotiatedShelfIndexes}
                  onToggleShelf={toggleShelf}
                  maxW={760}
                  maxH={640}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="space-y-4" key={object.id}>
        <Field>
          <FieldLabel htmlFor="object-name">Nome</FieldLabel>
          <Input
            id="object-name"
            defaultValue={object.name ?? ""}
            placeholder="Ex.: Gôndola A12"
            onBlur={(event) =>
              updateObject(object.id, { name: event.target.value || null })
            }
          />
        </Field>

        <Field>
          <FieldLabel>Tamanho do rótulo ({labelFont.toFixed(1)} m)</FieldLabel>
          <Slider
            value={[labelFont]}
            min={0.2}
            max={2}
            step={0.1}
            onValueChange={([value]) =>
              updateObject(object.id, {
                style: { ...object.style, fontSize: value },
              })
            }
          />
        </Field>

        {fixture && (
          <div
            className="space-y-3 rounded-md border p-3"
            key={`${object.id}-fixture`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mobiliário
            </p>
            {groupIds.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={selectGroup}
              >
                <Boxes className="size-4" />
                Selecionar móvel inteiro ({groupIds.length} peças)
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() =>
                rotateObjectsBy(
                  groupIds.length > 0 ? groupIds : [object.id],
                  90,
                )
              }
            >
              <RotateCw className="size-4" />
              Girar móvel 90°
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="fixture-shelves">Prateleiras</FieldLabel>
                <Input
                  id="fixture-shelves"
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  defaultValue={fixture.shelfCount}
                  onBlur={(event) => {
                    const total = Math.round(Number(event.target.value));
                    if (!Number.isFinite(total) || total < 1) return;
                    updateObject(object.id, {
                      properties: withFixtureProps(object, {
                        shelfCount: Math.min(20, total),
                      }),
                    });
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="fixture-height">Altura (m)</FieldLabel>
                <Input
                  id="fixture-height"
                  type="number"
                  min={0.1}
                  step="0.05"
                  defaultValue={object.heightM ?? ""}
                  onBlur={(event) => {
                    const next = Number(event.target.value);
                    updateObject(object.id, {
                      heightM: Number.isFinite(next) && next > 0 ? next : null,
                    });
                  }}
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              {fixture.negotiatedShelves}/{fixture.shelfCount} prateleiras
              negociadas — clique numa prateleira no desenho para negociá-la. A
              cor e o badge da gôndola no mapa (e no TradeGram público) seguem
              isso.
            </p>
          </div>
        )}

        {negotiable && (
          <>
            <Field>
              <FieldLabel>Estado do espaço</FieldLabel>
              <Select
                value={object.spaceState}
                onValueChange={(value) =>
                  updateObject(object.id, {
                    spaceState: value as (typeof SPACE_STATE_ORDER)[number],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPACE_STATE_ORDER.map((state) => (
                    <SelectItem key={state} value={state}>
                      {SPACE_STATE_META[state].dot}{" "}
                      {SPACE_STATE_META[state].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>ID do espaço</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={object.spaceCode ?? ""}
                  placeholder="Gere o Digital Space ID"
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title={object.spaceCode ? "Regenerar ID" : "Gerar ID"}
                  disabled={assignSpaceCode.isPending}
                  onClick={handleAssignCode}
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
            </Field>
          </>
        )}

        <Field>
          <FieldLabel htmlFor="object-location">Localização</FieldLabel>
          <Input
            id="object-location"
            defaultValue={negotiation.location ?? ""}
            placeholder="Ex.: Corredor 05 | Lado direito"
            onBlur={(event) => setNegotiation("location", event.target.value)}
          />
        </Field>
      </div>

      {/* Biblioteca Nacional de Espaços Comerciais — classificação padrão pra
          comparar e precificar entre lojas/redes. */}
      <div
        className="space-y-4 rounded-md border p-3"
        key={`${object.id}-library`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Biblioteca Nacional
        </p>

        <Field>
          <FieldLabel>Tipo de mídia</FieldLabel>
          <Select
            value={object.mediaTypeId ?? NONE}
            onValueChange={(value) =>
              saveSpaceParams({ mediaTypeId: value === NONE ? null : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de mídia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nenhum</SelectItem>
              <SelectGroup>
                <SelectLabel>Mídia física</SelectLabel>
                {mediaTypes
                  .filter((media) => media.kind === "FISICA")
                  .map((media) => (
                    <SelectItem key={media.id} value={media.id}>
                      {media.code} — {media.name}
                    </SelectItem>
                  ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Mídia digital</SelectLabel>
                {mediaTypes
                  .filter((media) => media.kind === "DIGITAL")
                  .map((media) => (
                    <SelectItem key={media.id} value={media.id}>
                      {media.code} — {media.name}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Setor</FieldLabel>
          <Select
            value={object.sectorId ?? NONE}
            onValueChange={(value) =>
              saveSpaceParams({ sectorId: value === NONE ? null : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nenhum</SelectItem>
              {storeSectors.map((sector) => (
                <SelectItem key={sector.id} value={sector.id}>
                  {sector.code} — {sector.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel>Categoria (tier)</FieldLabel>
            <Select
              value={object.tier ?? NONE}
              onValueChange={(value) =>
                saveSpaceParams({
                  tier: value === NONE ? null : (value as SpaceTier),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Não classificado</SelectItem>
                {SPACE_TIER_ORDER.map((tier) => (
                  <SelectItem key={tier} value={tier}>
                    {SPACE_TIER_LABELS[tier]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Fluxo</FieldLabel>
            <Select
              value={object.flowLevel ?? NONE}
              onValueChange={(value) =>
                saveSpaceParams({
                  flowLevel: value === NONE ? null : (value as SpaceFlowLevel),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Não classificado</SelectItem>
                {SPACE_FLOW_ORDER.map((flow) => (
                  <SelectItem key={flow} value={flow}>
                    {SPACE_FLOW_LABELS[flow]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field>
          <FieldLabel>Visibilidade</FieldLabel>
          <Select
            value={object.visibility ?? NONE}
            onValueChange={(value) =>
              saveSpaceParams({
                visibility: value === NONE ? null : (value as SpaceVisibility),
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Não classificada</SelectItem>
              {SPACE_VISIBILITY_ORDER.map((visibility) => (
                <SelectItem key={visibility} value={visibility}>
                  {SPACE_VISIBILITY_LABELS[visibility]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="object-exclusive">Exclusividade</FieldLabel>
            <Switch
              id="object-exclusive"
              checked={object.isExclusive}
              onCheckedChange={(checked) =>
                saveSpaceParams({ isExclusive: checked })
              }
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="object-revenue-potential">
              Potencial (R$)
            </FieldLabel>
            <Input
              id="object-revenue-potential"
              type="number"
              min={0}
              step="0.01"
              defaultValue={object.revenuePotential ?? ""}
              placeholder="0,00"
              onBlur={(event) =>
                saveSpaceParams({
                  revenuePotential: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="object-avg-sales">Venda média (R$)</FieldLabel>
            <Input
              id="object-avg-sales"
              type="number"
              min={0}
              step="0.01"
              defaultValue={object.avgSalesAmount ?? ""}
              placeholder="0,00"
              onBlur={(event) =>
                saveSpaceParams({
                  avgSalesAmount: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
            />
          </Field>
        </div>

        <Field>
          <FieldLabel>Área</FieldLabel>
          <p className="text-sm text-muted-foreground">
            {areaM2 > 0 ? `${areaM2.toFixed(2)} m²` : "—"}
          </p>
        </Field>
      </div>

      <Field>
        <FieldLabel>Empresa / Indústria</FieldLabel>
        <Select
          value={object.supplierId ?? NONE}
          onValueChange={(value) =>
            updateObject(object.id, {
              supplierId: value === NONE ? null : value,
              brandId: null,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a indústria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Nenhuma</SelectItem>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {object.supplierId && (
        <Field>
          <FieldLabel>Marca</FieldLabel>
          <Select
            value={object.brandId ?? NONE}
            onValueChange={(value) =>
              updateObject(object.id, {
                brandId: value === NONE ? null : value,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nenhuma</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <div className="space-y-4" key={`${object.id}-meta`}>
        <Field>
          <FieldLabel htmlFor="object-distributor">
            Distribuidor / Representante
          </FieldLabel>
          <Input
            id="object-distributor"
            defaultValue={negotiation.distributor ?? ""}
            placeholder="Ex.: Solar"
            onBlur={(event) =>
              setNegotiation("distributor", event.target.value)
            }
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="object-negotiation-start">Início</FieldLabel>
            <Input
              id="object-negotiation-start"
              type="date"
              defaultValue={negotiation.negotiationStart ?? ""}
              onBlur={(event) =>
                setNegotiation("negotiationStart", event.target.value)
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="object-negotiation-end">Fim</FieldLabel>
            <Input
              id="object-negotiation-end"
              type="date"
              defaultValue={negotiation.negotiationEnd ?? ""}
              onBlur={(event) =>
                setNegotiation("negotiationEnd", event.target.value)
              }
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="object-responsible">Responsável</FieldLabel>
          <Input
            id="object-responsible"
            defaultValue={object.responsibleName ?? ""}
            placeholder="Ex.: João (consultor)"
            onBlur={(event) =>
              updateObject(object.id, {
                responsibleName: event.target.value || null,
              })
            }
          />
        </Field>
      </div>

      {storeId && (
        <>
          <Separator />
          <PdvPhotoSection
            storeId={storeId}
            mapObjectId={object.id}
            defaultSupplierId={object.supplierId}
            defaultSection={
              storeSectors.find((sector) => sector.id === object.sectorId)
                ?.name ?? object.category
            }
          />
        </>
      )}
    </div>
  );
}
