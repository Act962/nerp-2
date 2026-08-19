import {
  FIXTURE_KIND_LABELS,
  FIXTURE_PRESETS,
  type FixturePreset,
} from "@/features/planogram/engine/fixture-presets";
import type { FixtureKind } from "@/features/planogram/engine/types";
import type { AddObjectInput } from "./scene-store";
import { CREATE_TOOLS_BY_TYPE } from "./tools";
import type { MapObjectStyle, MapObjectType, SceneObject } from "./types";

/**
 * Adapta o catálogo de mobiliário do PLANOGRAMA (`FIXTURE_PRESETS`, em mm) para o
 * mapa de loja (em metros). Não recria nada: reusa as medidas de mercado já
 * cadastradas e só traduz de unidade e de eixo.
 *
 * Ponto sutil do 2D top-down: o footprint no chão é **largura × profundidade**
 * (`widthMm × depthMm`). A `heightMm` do preset é a ELEVAÇÃO do móvel — vai para
 * `MapObject.heightM` (extrusão 3D futura + info), nunca para o footprint.
 */

/** Kind do planograma → tipo do objeto de mapa (não há "freezer" no mapa). */
const KIND_TO_MAP_TYPE: Record<FixtureKind, MapObjectType> = {
  GONDOLA: "GONDOLA",
  PONTA_GONDOLA: "GONDOLA",
  ILHA: "ISLAND",
  CHECKOUT: "CHECKOUT",
  GELADEIRA: "GONDOLA",
  EXPOSITOR: "GONDOLA",
  CLIP_STRIP: "GONDOLA",
};

/**
 * Faces do móvel vistas DE CIMA (colunas na profundidade). Gôndola no meio da
 * loja é dupla face (2); ponta/checkout encostam e mostram uma só. É a grade que
 * aparece desenhada no mapa junto com as divisões ao longo do comprimento.
 */
const DEFAULT_LANES_BY_KIND: Record<FixtureKind, number> = {
  GONDOLA: 2,
  PONTA_GONDOLA: 1,
  ILHA: 2,
  CHECKOUT: 1,
  GELADEIRA: 2,
  EXPOSITOR: 1,
  CLIP_STRIP: 1,
};

export interface MapFixtureModel {
  id: string;
  label: string;
  kind: FixtureKind;
  mapType: MapObjectType;
  /** Footprint no chão, em metros. */
  widthM: number;
  depthM: number;
  /** Elevação do móvel, em metros (vai para heightM). */
  fixtureHeightM: number;
  /** Divisões padrão ao longo do comprimento (default do input da paleta). */
  shelfCount: number;
  /** Faces padrão na profundidade (default do input da paleta). */
  lanes: number;
  style: MapObjectStyle;
}

const mmToM = (mm: number) => Math.round((mm / 1000) * 100) / 100;

function toModel(preset: FixturePreset): MapFixtureModel {
  const mapType = KIND_TO_MAP_TYPE[preset.kind];
  return {
    id: preset.id,
    label: preset.label,
    kind: preset.kind,
    mapType,
    widthM: mmToM(preset.widthMm),
    depthM: mmToM(preset.depthMm),
    fixtureHeightM: mmToM(preset.heightMm),
    shelfCount: preset.shelfCount,
    lanes: DEFAULT_LANES_BY_KIND[preset.kind] ?? 1,
    // Reaproveita a cor/estilo do tipo de mapa correspondente.
    style: CREATE_TOOLS_BY_TYPE.get(mapType)?.style ?? {},
  };
}

export const MAP_FIXTURE_MODELS: MapFixtureModel[] =
  FIXTURE_PRESETS.map(toModel);

export const MAP_FIXTURE_MODELS_BY_ID = new Map(
  MAP_FIXTURE_MODELS.map((model) => [model.id, model]),
);

/**
 * Metadados do mobiliário guardados em `MapObject.properties` (sob a chave
 * `fixture`, sem colidir com os campos de negociação). É o que liga a gôndola
 * desenhada ao seu preset/planograma numa fase futura.
 */
export interface FixtureProps {
  presetId: string;
  kind: FixtureKind;
  /** Total de prateleiras da célula (o "6" do badge 3/6). */
  shelfCount: number;
  /** Prateleiras já negociadas (o "3" do badge 3/6). */
  negotiatedShelves: number;
  /** Faces na profundidade (colunas da grade vista de cima). */
  lanes: number;
  moduleCount: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  baseHeightMm: number;
  /** Móvel a que a célula pertence — liga as N×M gôndolas do mesmo móvel. */
  fixtureGroupId?: string;
  /** Posição da célula na grade do móvel (0-based). */
  row?: number;
  col?: number;
}

export function buildFixtureProps(model: MapFixtureModel): FixtureProps {
  return {
    presetId: model.id,
    kind: model.kind,
    shelfCount: model.shelfCount,
    negotiatedShelves: 0,
    lanes: model.lanes,
    moduleCount: 1,
    widthMm: Math.round(model.widthM * 1000),
    heightMm: Math.round(model.fixtureHeightM * 1000),
    depthMm: Math.round(model.depthM * 1000),
    baseHeightMm:
      FIXTURE_PRESETS.find((p) => p.id === model.id)?.baseHeightMm ?? 100,
  };
}

/** Lê os metadados de mobiliário de um objeto, se ele for um móvel do catálogo. */
export function readFixtureProps(
  properties: Record<string, unknown> | null | undefined,
): FixtureProps | null {
  const raw = properties?.fixture;
  if (!raw || typeof raw !== "object") return null;
  const fixture = raw as Partial<FixtureProps>;
  if (typeof fixture.presetId !== "string") return null;
  const kind = (fixture.kind ?? "GONDOLA") as FixtureKind;
  return {
    presetId: fixture.presetId,
    kind,
    shelfCount: typeof fixture.shelfCount === "number" ? fixture.shelfCount : 1,
    negotiatedShelves:
      typeof fixture.negotiatedShelves === "number"
        ? fixture.negotiatedShelves
        : 0,
    // Móveis criados antes das faces caem no padrão do tipo (retrocompatível).
    lanes:
      typeof fixture.lanes === "number"
        ? fixture.lanes
        : (DEFAULT_LANES_BY_KIND[kind] ?? 1),
    moduleCount:
      typeof fixture.moduleCount === "number" ? fixture.moduleCount : 1,
    widthMm: typeof fixture.widthMm === "number" ? fixture.widthMm : 0,
    heightMm: typeof fixture.heightMm === "number" ? fixture.heightMm : 0,
    depthMm: typeof fixture.depthMm === "number" ? fixture.depthMm : 0,
    baseHeightMm:
      typeof fixture.baseHeightMm === "number" ? fixture.baseHeightMm : 100,
    fixtureGroupId:
      typeof fixture.fixtureGroupId === "string"
        ? fixture.fixtureGroupId
        : undefined,
    row: typeof fixture.row === "number" ? fixture.row : undefined,
    col: typeof fixture.col === "number" ? fixture.col : undefined,
  };
}

/**
 * Explode um móvel em `divisions × lanes` CÉLULAS reais (cada uma uma gôndola/
 * MapObject próprio), arrumadas em grade a partir do canto sup-esq. Cada célula
 * tem o tamanho do preset (largura × profundidade); divisões repetem no
 * comprimento (eixo X) e faces na profundidade (eixo Y). Todas compartilham o
 * `groupId` e a mesma config — é o que dá "as mesmas configurações" e permite
 * mover/selecionar o móvel inteiro. A grade some: são as próprias bordas das
 * células.
 */
export function buildFixtureCells(params: {
  model: MapFixtureModel;
  divisions: number;
  lanes: number;
  originX: number;
  originY: number;
  layerId: string;
  groupId: string;
}): AddObjectInput[] {
  const { model, originX, originY, layerId, groupId } = params;
  const divisions = Math.max(1, Math.round(params.divisions));
  const lanes = Math.max(1, Math.round(params.lanes));
  const base = buildFixtureProps(model);
  const label = FIXTURE_KIND_LABELS[model.kind] ?? model.label;

  const cells: AddObjectInput[] = [];
  let index = 0;
  for (let row = 0; row < lanes; row++) {
    for (let col = 0; col < divisions; col++) {
      index += 1;
      cells.push({
        type: model.mapType,
        layerId,
        geometry: {
          kind: "RECT",
          x: originX + col * model.widthM,
          y: originY + row * model.depthM,
          width: model.widthM,
          height: model.depthM,
          rotation: 0,
        },
        style: model.style,
        name: `${label} ${index}`,
        heightM: model.fixtureHeightM,
        properties: {
          fixture: { ...base, fixtureGroupId: groupId, row, col },
        },
      });
    }
  }
  return cells;
}

/** Mescla um patch nos metadados de mobiliário preservando o resto do JSON. */
export function withFixtureProps(
  object: SceneObject,
  patch: Partial<FixtureProps>,
): Record<string, unknown> {
  const current = readFixtureProps(object.properties);
  if (!current) return object.properties ?? {};
  return {
    ...(object.properties ?? {}),
    fixture: { ...current, ...patch },
  };
}
