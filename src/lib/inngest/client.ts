import { Inngest, eventType, staticSchema } from "inngest";
import type { MapSpaceState } from "@/generated/prisma/enums";
import type { SyncType } from "@/lib/sync-payloads";

/**
 * Cliente Inngest do NERP.
 *
 * Substitui o Vercel Cron: a entrega de eventos de sync (NERP → NASA) deixa de
 * ser por polling da `SyncOutbox` e passa a ser event-driven. Cada mudança de
 * auth emite `sync/nasa.requested`; a função `syncNasaDelivery` entrega ao NASA
 * com retry/backoff nativos do Inngest.
 */

/**
 * Payload do evento de entrega. Carrega o `type` + `payload` canônico (ver
 * `sync-payloads.ts`) e, opcionalmente, o `outboxId` da linha de auditoria em
 * `SyncOutbox` para que a função marque `deliveredAt`.
 */
export type SyncRequestedData = {
  type: SyncType;
  payload: unknown;
  outboxId?: string;
};

// Em dev (`isDev: true`) o SDK entrega ao Dev Server local (`pnpm inngest:dev`)
// e NÃO exige `INNGEST_EVENT_KEY`. Em prod usa a chave do ambiente (Inngest Cloud).
export const inngest = new Inngest({
  id: "nerp",
  isDev: process.env.NODE_ENV !== "production",
});

/**
 * Definição tipada do evento — serve como trigger da função e como fábrica
 * type-safe para `inngest.send(...)`. `staticSchema` dá tipagem em tempo de
 * compilação sem validação em runtime (sem dependência de Zod aqui).
 */
export const syncNasaRequested = eventType("sync/nasa.requested", {
  schema: staticSchema<SyncRequestedData>(),
});

/**
 * Importação de produtos via planilha (CSV/XLSX).
 *
 * Disparado por `products.import.create` após o upload do arquivo ao S3 e a
 * criação da linha `ProductImport`. Carrega apenas o `importId`; a função
 * `productImportProcess` busca o registro, baixa o arquivo e processa em lotes.
 */
export type ProductImportRequestedData = { importId: string };

export const productImportRequested = eventType("products/import.requested", {
  schema: staticSchema<ProductImportRequestedData>(),
});

/**
 * Importação de fornecedores via planilha (CSV/XLSX).
 *
 * Disparado por `supplier.import.create` após o upload do arquivo ao S3 e a
 * criação da linha `SupplierImport`. Carrega apenas o `importId`; a função
 * `supplierImportProcess` busca o registro, baixa o arquivo e processa as linhas.
 */
export type SupplierImportRequestedData = { importId: string };

export const supplierImportRequested = eventType("suppliers/import.requested", {
  schema: staticSchema<SupplierImportRequestedData>(),
});

/**
 * Importação de clientes via planilha (CSV/XLSX).
 *
 * Disparado por `customer.import.create` após o upload do arquivo ao S3 e a
 * criação da linha `CustomerImport`. Carrega apenas o `importId`; a função
 * `customerImportProcess` busca o registro, baixa o arquivo e processa as linhas.
 */
export type CustomerImportRequestedData = { importId: string };

export const customerImportRequested = eventType("customers/import.requested", {
  schema: staticSchema<CustomerImportRequestedData>(),
});

/**
 * Geração do Book em PDF (Trade Marketing).
 *
 * Disparado por `book.generate` após marcar o Book como GENERATING. A função
 * `bookGenerate` carrega o book + itens (fotos do PDV) + logos e renderiza o
 * PDF server-side (@react-pdf/renderer), salvando em R2 e marcando READY.
 */
export type BookGenerateRequestedData = { bookId: string };

export const bookGenerateRequested = eventType("book/generate.requested", {
  schema: staticSchema<BookGenerateRequestedData>(),
});

/**
 * Geração do Catálogo PDV em PDF (Trade Marketing).
 *
 * Disparado por `tradeCatalogDoc.generate` após marcar o catálogo como
 * GENERATING. A função `tradeCatalogGenerate` carrega o catálogo + páginas e
 * renderiza o PDF server-side (@react-pdf/renderer), salvando em R2 e marcando
 * READY. Mesmo pipeline do Book (bookGenerateRequested acima).
 */
export type TradeCatalogGenerateRequestedData = { catalogId: string };

export const tradeCatalogGenerateRequested = eventType(
  "trade-catalog/generate.requested",
  { schema: staticSchema<TradeCatalogGenerateRequestedData>() },
);

/**
 * PDV Map — preparação da integração com o Tracking Órbita e o Forge.
 *
 * Emitidos quando o estado de um espaço muda ou uma negociação nasce, para que
 * o Forge (futuro) automatize prazos e alertas de contrato. Nesta fase são só
 * declarações: não há função consumidora, então são inertes até a integração.
 */
export type MapSpaceStateChangedData = {
  organizationId: string;
  floorPlanId: string;
  mapObjectId: string;
  spaceCode: string | null;
  from: MapSpaceState;
  to: MapSpaceState;
};

export const mapSpaceStateChanged = eventType("pdv/space.state.changed", {
  schema: staticSchema<MapSpaceStateChangedData>(),
});

export type NegotiationCreatedData = {
  organizationId: string;
  mapObjectId: string;
  negotiationId: string;
  supplierId: string | null;
  endDate: string | null;
};

export const negotiationCreated = eventType("pdv/negotiation.created", {
  schema: staticSchema<NegotiationCreatedData>(),
});

/**
 * Alerta de queda de preço para o app do cliente (Shopper).
 *
 * Emitido quando o preço efetivo (promo ?? venda) de um produto cai. A função
 * `shopperPriceAlert` acha os favoritos com `notifyOnDrop`, deduplica por
 * `lastNotifiedPrice` e notifica (e-mail via Resend, best-effort).
 */
export type ShopperPriceChangedData = {
  organizationId: string;
  productId: string;
  oldPrice: number;
  newPrice: number;
};

export const shopperPriceChanged = eventType("shopper/price.changed", {
  schema: staticSchema<ShopperPriceChangedData>(),
});

/**
 * Sync do ERP externo (Winthor/Oracle hoje) para as tabelas canônicas.
 *
 * Emitido pelo cron `erpSyncSchedule`, um evento por organização, e também pela
 * procedure `erpSync.run` (botão "Atualizar agora"). Um evento por org — em vez
 * de um laço numa função só — isola falha: ERP de um cliente fora do ar não
 * atrasa nem consome o retry dos outros.
 *
 * `windowDays` é quantos dias para trás reprocessar. Não é enfeite: pedido no
 * Winthor muda de POSICAO depois de criado, então reler só "hoje" perderia o
 * pedido de terça que virou faturado na quinta.
 */
export type ErpSyncRequestedData = {
  organizationId: string;
  windowDays?: number;
};

export const erpSyncRequested = eventType("erp/sync.requested", {
  schema: staticSchema<ErpSyncRequestedData>(),
});
