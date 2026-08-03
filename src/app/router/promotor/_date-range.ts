import { z } from "zod";

/** Recorte de data das listas de fotos. Instantes ISO, já resolvidos no fuso
 * do aparelho pelo `rangeToInstants` — o servidor não tenta adivinhar o dia. */
export const dateRangeSchema = {
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
};

export function capturedAtFilter(from?: string, to?: string) {
  if (!from && !to) return {};
  return {
    capturedAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    },
  };
}
