import type { ReceiptPaper } from "../types";

/**
 * Largura do papel em COLUNAS de caractere, que é a unidade da térmica.
 *
 * A fonte A tem 12 dots de largura; a 203 dpi, 58mm imprimíveis dão 32 colunas
 * e 80mm dão 48. `paper.ts` só conhece milímetros, que servem ao CSS; a
 * impressora não sabe o que é milímetro.
 */
export const PAPER_COLS: Record<ReceiptPaper, number> = {
  MM58: 32,
  MM80: 48,
  // A4 não é alvo da térmica; o valor existe só para o tipo fechar.
  A4: 48,
};
