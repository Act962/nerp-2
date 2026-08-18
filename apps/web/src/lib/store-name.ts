/** Palavras que não distinguem uma loja de outra no ramo. */
const NOISE = new Set([
  "supermercado",
  "supermercados",
  "super",
  "mercado",
  "mercados",
  "mercadinho",
  "hipermercado",
  "atacado",
  "atacadista",
  "loja",
  "filial",
  "ltda",
  "me",
  "epp",
  "sa",
  "eireli",
  "comercio",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
]);

/**
 * Nome de loja reduzido ao que de fato identifica.
 *
 * Mora em `src/lib` porque três caminhos precisam concordar: o casamento com o
 * OpenStreetMap, a importação de planilha e qualquer dedupe futuro. Duas cópias
 * divergiriam em silêncio — e o sintoma seria cliente duplicado, que só aparece
 * quando o promotor já tirou foto nos dois cadastros.
 */
export function normalizeStoreName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0 && !NOISE.has(word))
    .join(" ")
    .trim();
}

/** Cidade normalizada só para desempatar nomes iguais. */
export function normalizeCity(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
