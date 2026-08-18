import { z } from "zod";

// Uma linha da página do catálogo = uma loja com N espaços daquele tipo de
// mídia. Snapshot editável (guardado em TradeCatalogPage.rows como JSON) — não
// muda sozinho quando o mapa muda; o usuário edita nome/valor/qtd/status/loja.
export const catalogRowSchema = z.object({
  id: z.string(),
  storeId: z.string().nullable().optional(),
  storeName: z.string(),
  mediaTypeName: z.string(),
  quantity: z.number().int().nonnegative(),
  price: z.number().nonnegative().nullable(),
  status: z.string(),
  note: z.string().nullable().optional(),
});

export type CatalogRow = z.infer<typeof catalogRowSchema>;

export const catalogRowsSchema = z.array(catalogRowSchema);
