export type PhotoOrientation = "LANDSCAPE" | "PORTRAIT";

// Máximo de fotos por página conforme a orientação: horizontais cabem 2 lado a
// lado; verticais até 4 (uma do lado da outra).
export const MAX_PER_PAGE: Record<PhotoOrientation, number> = {
  LANDSCAPE: 2,
  PORTRAIT: 4,
};

export interface PlannedPage {
  orientation: PhotoOrientation;
  size: number; // 1..MAX_PER_PAGE[orientation]
}

// Quebra uma quantidade de fotos de UMA orientação em páginas do tamanho máximo
// da orientação; a última página leva o resto. Horizontal(5)→[2,2,1];
// Vertical(9)→[4,4,1].
function chunk(total: number, max: number): number[] {
  const pages: number[] = [];
  let remaining = Math.max(0, Math.floor(total));
  while (remaining > 0) {
    const size = Math.min(max, remaining);
    pages.push(size);
    remaining -= size;
  }
  return pages;
}

// Plano de páginas de uma loja, separando por orientação. As horizontais vêm
// primeiro (páginas de ≤2), depois as verticais (≤4).
export function planPagesByOrientation(counts: {
  landscape: number;
  portrait: number;
}): PlannedPage[] {
  const pages: PlannedPage[] = [];
  for (const size of chunk(counts.landscape, MAX_PER_PAGE.LANDSCAPE)) {
    pages.push({ orientation: "LANDSCAPE", size });
  }
  for (const size of chunk(counts.portrait, MAX_PER_PAGE.PORTRAIT)) {
    pages.push({ orientation: "PORTRAIT", size });
  }
  return pages;
}

// Classifica uma proporção (largura/altura) em orientação. Perto de quadrado
// (0.9–1.1) tratamos como retrato, que é a foto de gôndola típica.
export function orientationFromAspect(aspect: number | null): PhotoOrientation {
  if (aspect && aspect > 1.1) return "LANDSCAPE";
  return "PORTRAIT";
}

// Rótulo legível de um padrão de página de fotos.
export function photoPatternLabel(
  orientation: PhotoOrientation,
  size: number,
): string {
  const noun = orientation === "LANDSCAPE" ? "horizontal" : "vertical";
  return `${size} foto${size > 1 ? "s" : ""} ${noun}${size > 1 ? "is" : ""}`;
}
