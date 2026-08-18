"use client";

import { Button } from "@/components/ui/button";
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
import { useMediaTypes, useStoreSectors } from "@/features/trade-catalog/hooks/use-trade-catalog";
import { RefreshCw, Trash2 } from "lucide-react";
import { areaOf } from "../engine/geometry";
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

export function ObjectPropertiesPanel() {
  const selectedIds = useSceneStore((state) => state.selectedIds);
  const objects = useSceneStore((state) => state.objects);
  const updateObject = useSceneStore((state) => state.updateObject);
  const removeSelected = useSceneStore((state) => state.removeSelected);
  const storeId = useSceneStore((state) => state.floorPlan?.storeId);

  const object = selectedIds.length === 1 ? objects[selectedIds[0]] : undefined;
  const { suppliers } = useSupplier();
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
        <p className="text-sm">{selectedIds.length} objetos selecionados</p>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={removeSelected}
        >
          <Trash2 className="size-4" />
          Excluir selecionados
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
                      {SPACE_STATE_META[state].dot} {SPACE_STATE_META[state].label}
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
      <div className="space-y-4 rounded-md border p-3" key={`${object.id}-library`}>
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
              onCheckedChange={(checked) => saveSpaceParams({ isExclusive: checked })}
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
