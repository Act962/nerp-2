import { buildFixtureProps, type MapFixtureModel } from "./fixture-catalog";
import type { AddObjectInput } from "./scene-store";

/**
 * Geração automática de um bloco de gôndolas em fileiras — mata o "inserir uma a
 * uma". Tudo em metros. Função PURA (nenhum efeito): devolve os objetos a serem
 * criados; quem chama faz `addObject` de cada um e o autosave persiste.
 *
 * Disposição: cada fileira é uma linha de gôndolas encostadas ao longo de X;
 * as fileiras se empilham em Y, separadas por (profundidade da gôndola +
 * corredor). Rotação 0 (Fase 1 — só horizontal).
 */
export interface AisleBlockParams {
  model: MapFixtureModel;
  layerId: string;
  /** Nº de fileiras (linhas de gôndolas). */
  rows: number;
  /** Nº de gôndolas por fileira. */
  perRow: number;
  /** Largura do corredor entre fileiras, em metros. */
  aisleM: number;
  /** Canto superior-esquerdo do bloco, em metros. */
  originX: number;
  originY: number;
  /** Limites do mapa, em metros — o bloco é recortado pra caber. */
  planWidthM: number;
  planHeightM: number;
  mediaTypeId: string | null;
}

export function generateAisleBlock(params: AisleBlockParams): AddObjectInput[] {
  const {
    model,
    layerId,
    rows,
    perRow,
    aisleM,
    originX,
    originY,
    planWidthM,
    planHeightM,
    mediaTypeId,
  } = params;

  const width = model.widthM;
  const depth = model.depthM;
  const rowPitch = depth + Math.max(0, aisleM);
  const objects: AddObjectInput[] = [];
  const fixtureProps = buildFixtureProps(model);

  for (let row = 0; row < Math.max(0, rows); row++) {
    const y = originY + row * rowPitch;
    // Recorta fileiras que passariam do fundo do mapa.
    if (y + depth > planHeightM) break;

    for (let col = 0; col < Math.max(0, perRow); col++) {
      const x = originX + col * width;
      // Recorta gôndolas que passariam da borda direita do mapa.
      if (x + width > planWidthM) break;

      objects.push({
        type: model.mapType,
        layerId,
        geometry: { kind: "RECT", x, y, width, height: depth, rotation: 0 },
        style: model.style,
        name: model.label,
        heightM: model.fixtureHeightM,
        mediaTypeId,
        properties: { fixture: { ...fixtureProps } },
      });
    }
  }

  return objects;
}
