/** Valor (reais) → centavos inteiros. */
export const toCents = (n: number) => Math.round(n * 100);

/** Centavos (inteiro) → moeda pt-BR: 234500 → "2.345,00". */
export const formatCents = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
