/** Produto no catálogo LOCAL do device (espelho do que o server manda no pull). */
export type LocalProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  salePrice: number;
  currentStock: number;
  unit: string;
  isActive: boolean;
  /** ISO — usado como watermark do sync incremental. */
  updatedAt: string;
};

/** Cursor de keyset do sync incremental (última linha vista). */
export type SyncCursor = { updatedAt: string; id: string };

/** Uma página do pull server→device. */
export type CatalogPage = {
  products: LocalProduct[];
  cursor: SyncCursor | null;
  hasMore: boolean;
};

/** Assinatura do pull, injetada pelo host (o desktop liga em client.products.pull). */
export type CatalogPull = (input: {
  updatedAt: string | null;
  id: string | null;
  limit: number;
}) => Promise<CatalogPage>;

/** Resultado de uma rodada de sync. */
export type SyncResult = {
  pulled: number;
  cursor: SyncCursor | null;
  syncedAt: string;
};
