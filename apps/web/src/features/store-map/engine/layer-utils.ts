import type { SceneLayer } from "./types";

/**
 * Camada onde o mobiliário gerado deve cair. O `floorPlan.create` semeia uma
 * camada "Gôndolas"; se ela existir, o móvel entra nela (mantém o mapa
 * organizado), senão usa a camada ativa como fallback.
 */
export function fixtureLayerId(
  layers: SceneLayer[],
  activeLayerId: string | null,
): string | null {
  const gondolas = layers.find((layer) =>
    layer.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .includes("gondola"),
  );
  return gondolas?.id ?? activeLayerId;
}
