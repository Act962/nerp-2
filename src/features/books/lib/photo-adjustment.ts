import type { CoverElement } from "./cover-layout";

// Enquadramento (pan/zoom) de uma foto dentro do slot fixo do padrão de
// página. `zoom` >= 1 (1 = só o "cover" padrão, sem zoom extra). `posX`/
// `posY` seguem exatamente a semântica de `object-position` do CSS (0-100,
// 0% = mostra a borda esquerda/superior da imagem, 100% = mostra a borda
// direita/inferior) — isso deixa o editor (CSS puro) e o corte no PDF
// (sharp) usando a mesma matemática, sem duplicar lógica de posicionamento.
export interface PhotoAdjustment {
  zoom: number;
  posX: number;
  posY: number;
  backdrop?: PhotoBackdrop;
  backdropColor?: string;
  // Polígono desenhado pelo usuário que fica nítido quando backdrop === "blur";
  // o resto da foto sai desfocado. Cada nó em % do espaço da foto (0-100).
  // Menos de 3 nós = nada nítido ainda (foto toda desfocada).
  focusPolygon?: FocusPoint[];
}

// "blur" = foco seletivo: o polígono `focusPolygon` fica nítido e o resto
// desfocado. "color" pinta uma cor sólida atrás de uma foto "caber inteira".
export type PhotoBackdrop = "none" | "blur" | "color";

// Nó do polígono de foco, em % do espaço da foto (0-100).
export interface FocusPoint {
  x: number;
  y: number;
}

export const DEFAULT_PHOTO_ADJUSTMENT: PhotoAdjustment = {
  zoom: 1,
  posX: 50,
  posY: 50,
};

export const DEFAULT_BACKDROP_COLOR = "#ffffff";

// CSS clip-path a partir dos nós; abaixo de 3 nós não há área fechada.
export function focusPolygonCss(points: FocusPoint[]): string | undefined {
  if (points.length < 3) return undefined;
  return `polygon(${points.map((point) => `${point.x}% ${point.y}%`).join(", ")})`;
}

export type PhotoAdjustmentMap = Record<string, PhotoAdjustment>;

export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Reproduz o algoritmo do CSS `object-fit: cover` + `object-position` do
// navegador (foto cobrindo o container, cortada e alinhada por posX/posY),
// seguido de um `transform: scale(zoom)` a partir do centro do container —
// exatamente o que o editor renderiza. Retorna o retângulo de corte em
// pixels da imagem ORIGINAL (para usar com `sharp().extract()`).
export function computeCropRect(
  adjustment: PhotoAdjustment,
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): CropRect {
  const zoom = Math.max(adjustment.zoom, 1);
  const scale = Math.max(
    containerWidth / naturalWidth,
    containerHeight / naturalHeight,
  );
  const renderWidth = naturalWidth * scale;
  const renderHeight = naturalHeight * scale;
  const excessX = renderWidth - containerWidth;
  const excessY = renderHeight - containerHeight;

  const left0 = -excessX * (adjustment.posX / 100);
  const top0 = -excessY * (adjustment.posY / 100);

  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;

  const cropLeftRender = centerX * (1 - 1 / zoom) - left0;
  const cropTopRender = centerY * (1 - 1 / zoom) - top0;
  const cropWidthRender = containerWidth / zoom;
  const cropHeightRender = containerHeight / zoom;

  const left = clamp(cropLeftRender / scale, 0, naturalWidth);
  const top = clamp(cropTopRender / scale, 0, naturalHeight);
  const width = clamp(cropWidthRender / scale, 1, naturalWidth - left);
  const height = clamp(cropHeightRender / scale, 1, naturalHeight - top);

  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Proporção (largura/altura) da área de fotos no PDF: página 960x540, menos
// cabeçalho/rodapé e a coluna de metadados (ver estilos em book-document.tsx
// — body padding 20, meta width 210, gap 18). `computeCropRect` só depende
// da PROPORÇÃO do container, não do tamanho absoluto, então esses valores
// aproximados bastam pra reproduzir o mesmo corte calculado no editor.
const PHOTO_AREA_RATIO = 692 / 410;

export interface PhotoSlotShape {
  aspectRatio: number;
  objectFit: "contain" | "cover";
}

// Slots de um layout de página customizado, indexados por `slotIndex`. As
// proporções de `getSlotAspectRatio` abaixo valem só para o layout fixo; num
// layout desenhado pelo usuário quem manda é o tamanho do slot.
export function buildPhotoSlotMap(
  layout: CoverElement[] | null,
): Map<number, PhotoSlotShape> | null {
  if (!layout) return null;
  const slots = new Map<number, PhotoSlotShape>();
  for (const element of layout) {
    if (element.type !== "photoSlot" || element.height <= 0) continue;
    slots.set(element.slotIndex, {
      aspectRatio: element.width / element.height,
      objectFit: element.objectFit,
    });
  }
  return slots;
}

// Espelha exatamente o branching de `PhotoLayout` em book-document.tsx —
// cada slot nomeado ou automático tem uma proporção fixa e previsível.
export function getSlotAspectRatio(
  pattern: "PATTERN_1" | "PATTERN_2" | "PATTERN_3" | "PATTERN_4" | null,
  index: number,
  totalPhotos: number,
): number {
  if (pattern === "PATTERN_1" && totalPhotos === 3) {
    return index === 0 ? PHOTO_AREA_RATIO / 2 : PHOTO_AREA_RATIO;
  }
  if (pattern === "PATTERN_2" && totalPhotos === 3) {
    return index === 2 ? PHOTO_AREA_RATIO / 2 : PHOTO_AREA_RATIO;
  }
  if (pattern === "PATTERN_3" && totalPhotos === 2) {
    return PHOTO_AREA_RATIO / 2;
  }
  if (pattern === "PATTERN_4" && totalPhotos === 2) {
    return PHOTO_AREA_RATIO * 2;
  }
  if (totalPhotos === 1) return PHOTO_AREA_RATIO;
  if (totalPhotos === 2) return PHOTO_AREA_RATIO / 2;
  return PHOTO_AREA_RATIO;
}
