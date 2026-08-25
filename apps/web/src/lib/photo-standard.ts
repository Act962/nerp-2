// Padrão único de dimensão das fotos do book. A mesma imagem, só girada:
// vertical 3:4, horizontal 4:3 — a proporção nativa da câmera do celular, então
// o promotor não precisa cortar quase nada. O App Promotor normaliza a captura
// para essas proporções e os "espaços de foto" em /padroes nascem com elas, de
// modo que a foto encaixa 100% no espaço, sem corte nem borda.

export type StandardPhotoOrientation = "PORTRAIT" | "LANDSCAPE";

/** Proporção largura/altura de cada orientação. */
export const STANDARD_PHOTO_ASPECT: Record<StandardPhotoOrientation, number> = {
  PORTRAIT: 3 / 4,
  LANDSCAPE: 4 / 3,
};

/** Pixels de saída da foto normalizada no App Promotor. */
export const STANDARD_PHOTO_PX: Record<
  StandardPhotoOrientation,
  { width: number; height: number }
> = {
  PORTRAIT: { width: 1200, height: 1600 },
  LANDSCAPE: { width: 1600, height: 1200 },
};

/** Tamanho inicial do espaço de foto no canvas do editor (960×540). */
export const STANDARD_SLOT_SIZE: Record<
  StandardPhotoOrientation,
  { width: number; height: number }
> = {
  PORTRAIT: { width: 240, height: 320 },
  LANDSCAPE: { width: 320, height: 240 },
};

/** Orientação padrão a partir da proporção medida de uma imagem. */
export function standardOrientation(
  width: number,
  height: number,
): StandardPhotoOrientation {
  return width >= height ? "LANDSCAPE" : "PORTRAIT";
}
