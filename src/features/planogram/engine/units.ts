// O engine inteiro trabalha em milímetro inteiro; a UI fala em centímetro.
// Estas são as ÚNICAS funções que atravessam essa fronteira.

/** 127 -> "12,7 cm" */
export function formatMm(
  valueMm: number,
  options?: { unit?: boolean },
): string {
  const cm = valueMm / 10;
  const text = cm.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  return options?.unit === false ? text : `${text} cm`;
}

/** 1900 -> "1,90 m" — para altura de gôndola, onde metro lê melhor. */
export function formatMmAsMeters(valueMm: number): string {
  return `${(valueMm / 1000).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} m`;
}

/** "12,7" ou "12.7" -> 127. Devolve null quando não dá pra interpretar. */
export function parseCmToMm(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!normalized) return null;
  const cm = Number(normalized);
  if (!Number.isFinite(cm) || cm < 0) return null;
  return Math.round(cm * 10);
}

/** Arredonda para o passo do snap (padrão 10mm = 1cm). */
export function snapMm(valueMm: number, stepMm = 10): number {
  if (stepMm <= 0) return Math.round(valueMm);
  return Math.round(valueMm / stepMm) * stepMm;
}

export function clampMm(valueMm: number, minMm: number, maxMm: number): number {
  return Math.min(Math.max(valueMm, minMm), maxMm);
}
