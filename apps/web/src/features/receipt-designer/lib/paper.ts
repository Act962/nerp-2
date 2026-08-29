import type { ReceiptPaper } from "./types";

// Medidas físicas do papel, em mm. A largura imprimível é menor que a bobina:
// uma térmica de 80mm imprime ~72mm (576 dots a 203dpi) e o restante é margem
// mecânica. A diferença vira folga simétrica, o que mantém o cupom dentro da
// área imprimível de qualquer driver.
export const PAPER_MM: Record<ReceiptPaper, { page: number; content: number }> =
  {
    MM80: { page: 80, content: 72 },
    MM58: { page: 58, content: 48 },
    A4: { page: 210, content: 186 },
  };

// CSS assume 96dpi para converter px em unidades absolutas.
export const PX_PER_MM = 96 / 25.4;
