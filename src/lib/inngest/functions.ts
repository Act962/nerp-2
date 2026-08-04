import prisma from "@/lib/db";
import {
  listOrganizationsForSync,
  runErpSync,
} from "@/features/erp-sync/server/run-erp-sync";
import { deliver } from "@/lib/sync-deliver";
import { runProductImport } from "@/features/products/server/import-runner";
import { runSupplierImport } from "@/features/supplier/server/supplier-import-runner";
import { runCustomerImport } from "@/features/custom/server/customer-import-runner";
import {
  CHUNK_ROWS,
  runStoreImportChunk,
} from "@/features/stores/server/store-import-runner";
import { generateBook } from "@/features/books/server/generate-book";
import { generateTradeCatalogPdf } from "@/features/pdv-catalog/server/generate-catalog-pdf";
import { runShopperPriceAlert } from "@/features/shopper/server/price-alert";
import { checkWidgetAlerts } from "@/features/dashboard-widgets/server/check-widget-alerts";
import {
  bookGenerateRequested,
  customerImportRequested,
  erpSyncRequested,
  inngest,
  productImportRequested,
  shopperPriceChanged,
  storeImportRequested,
  supplierImportRequested,
  syncNasaRequested,
  tradeCatalogGenerateRequested,
} from "./client";

/**
 * Entrega event-driven da SyncOutbox (NERP → NASA).
 *
 * Disparada por `sync/nasa.requested`. Entrega o payload ao NASA via cliente
 * outbound; em falha, o step falha e o Inngest reagenda com backoff exponencial
 * nativo (até `retries` tentativas) — substituindo o backoff manual do antigo
 * cron. A `SyncOutbox` é atualizada apenas para auditoria/observabilidade.
 *
 * `idempotency` na `payload.id` (cuid) evita entregas duplicadas do mesmo
 * registro dentro da janela do Inngest.
 */
export const syncNasaDelivery = inngest.createFunction(
  {
    id: "sync-nasa-delivery",
    triggers: [syncNasaRequested],
    retries: 5,
    idempotency: "event.data.payload.id",
    onFailure: async ({ event, error }) => {
      // Esgotou as tentativas: registra o erro na linha de auditoria, se houver.
      const { outboxId } = event.data.event.data;
      if (!outboxId) return;
      await prisma.syncOutbox
        .update({
          where: { id: outboxId },
          data: {
            attempts: { increment: 1 },
            lastError: (error?.message ?? String(error)).slice(0, 500),
          },
        })
        .catch(() => {});
    },
  },
  async ({ event, step }) => {
    const { type, payload, outboxId } = event.data;

    await step.run("deliver", () => deliver(type, payload));

    if (outboxId) {
      await step.run("mark-delivered", async () => {
        await prisma.syncOutbox
          .update({
            where: { id: outboxId },
            data: { deliveredAt: new Date(), lastError: null },
          })
          .catch(() => {});
      });
    }

    return { delivered: true, type };
  },
);

/**
 * Importação de produtos via planilha (CSV/XLSX).
 *
 * Disparada por `products/import.requested`. Processa o arquivo num único
 * `step.run` — `runProductImport` faz importação parcial (erros por linha não
 * abortam o lote), então o step só falha em erros de infraestrutura (S3/DB), que
 * o Inngest reagenda com backoff. Como o step é memoizado quando bem-sucedido,
 * ele não reexecuta após concluir. `onFailure` marca o registro como `FAILED`.
 */
export const productImportProcess = inngest.createFunction(
  {
    id: "product-import-process",
    triggers: [productImportRequested],
    retries: 2,
    concurrency: { limit: 5 },
    onFailure: async ({ event, error }) => {
      const { importId } = event.data.event.data;
      await prisma.productImport
        .update({
          where: { id: importId },
          data: {
            status: "FAILED",
            completedAt: new Date(),
          },
        })
        .catch(() => {});
      console.error(`[product-import] falha em ${importId}:`, error);
    },
  },
  async ({ event, step }) => {
    const { importId } = event.data;

    await step.run("process-import", () => runProductImport(importId));

    return { importId, done: true };
  },
);

/**
 * Importação de fornecedores via planilha (CSV/XLSX).
 *
 * Disparada por `suppliers/import.requested`. Processa o arquivo num único
 * `step.run` — `runSupplierImport` faz importação parcial (erros por linha não
 * abortam o lote), então o step só falha em erros de infraestrutura (S3/DB), que
 * o Inngest reagenda com backoff. Como o step é memoizado quando bem-sucedido,
 * ele não reexecuta após concluir. `onFailure` marca o registro como `FAILED`.
 */
export const supplierImportProcess = inngest.createFunction(
  {
    id: "supplier-import-process",
    triggers: [supplierImportRequested],
    retries: 2,
    concurrency: { limit: 5 },
    onFailure: async ({ event, error }) => {
      const { importId } = event.data.event.data;
      await prisma.supplierImport
        .update({
          where: { id: importId },
          data: {
            status: "FAILED",
            completedAt: new Date(),
          },
        })
        .catch(() => {});
      console.error(`[supplier-import] falha em ${importId}:`, error);
    },
  },
  async ({ event, step }) => {
    const { importId } = event.data;

    await step.run("process-import", () => runSupplierImport(importId));

    return { importId, done: true };
  },
);

/**
 * Importação de clientes via planilha (CSV/XLSX).
 *
 * Disparada por `customers/import.requested`. Processa o arquivo num único
 * `step.run` — `runCustomerImport` faz importação parcial (erros por linha não
 * abortam o lote), então o step só falha em erros de infraestrutura (S3/DB), que
 * o Inngest reagenda com backoff. Como o step é memoizado quando bem-sucedido,
 * ele não reexecuta após concluir. `onFailure` marca o registro como `FAILED`.
 */
export const customerImportProcess = inngest.createFunction(
  {
    id: "customer-import-process",
    triggers: [customerImportRequested],
    retries: 2,
    concurrency: { limit: 5 },
    onFailure: async ({ event, error }) => {
      const { importId } = event.data.event.data;
      await prisma.customerImport
        .update({
          where: { id: importId },
          data: {
            status: "FAILED",
            completedAt: new Date(),
          },
        })
        .catch(() => {});
      console.error(`[customer-import] falha em ${importId}:`, error);
    },
  },
  async ({ event, step }) => {
    const { importId } = event.data;

    await step.run("process-import", () => runCustomerImport(importId));

    return { importId, done: true };
  },
);

/**
 * Teto de lotes por importação — 200 × 500 = 100 mil linhas. Bound explícito
 * para o laço nunca ficar solto se um lote parar de avançar o offset.
 */
const MAX_IMPORT_BATCHES = 200;

/**
 * Importação de lojas via planilha (CSV/XLSX).
 *
 * Disparada por `stores/import.requested`. O arquivo é processado em lotes de
 * `CHUNK_ROWS` linhas, um `step.run` por lote, porque o step precisa caber numa
 * invocação serverless: com o arquivo inteiro num passo só, uma lista de 15 mil
 * clientes estourava o tempo, o step nunca era memoizado e o Inngest recomeçava
 * da primeira linha a cada tentativa. Com o lote memoizado, a retentativa
 * reexecuta no máximo um lote.
 *
 * `runStoreImportChunk` faz importação parcial (erros por linha não abortam o
 * lote), então o step só falha em erro de infraestrutura (S3/DB), que o Inngest
 * reagenda com backoff. `onFailure` marca o registro como `FAILED`.
 */
export const storeImportProcess = inngest.createFunction(
  {
    id: "store-import-process",
    triggers: [storeImportRequested],
    retries: 2,
    concurrency: { limit: 5 },
    onFailure: async ({ event, error }) => {
      const { importId } = event.data.event.data;
      await prisma.storeImport
        .update({
          where: { id: importId },
          data: {
            status: "FAILED",
            completedAt: new Date(),
          },
        })
        .catch(() => {});
      console.error(`[store-import] falha em ${importId}:`, error);
    },
  },
  async ({ event, step }) => {
    const { importId } = event.data;

    let offset = 0;
    for (let batch = 0; batch < MAX_IMPORT_BATCHES; batch++) {
      // O id do step vem do offset, que avança de forma determinística — é o
      // que permite ao Inngest reconhecer os lotes já concluídos numa replay.
      const result = await step.run(`import-rows-${offset}`, () =>
        runStoreImportChunk(importId, offset),
      );
      if (result.done) return { importId, processedRows: result.nextOffset };
      offset = result.nextOffset;
    }

    throw new Error(
      `Importação ${importId} excedeu ${MAX_IMPORT_BATCHES} lotes de ${CHUNK_ROWS} linhas`,
    );
  },
);

/**
 * Geração do Book em PDF (Trade Marketing).
 *
 * Disparada por `book/generate.requested`. Renderiza o PDF num único
 * `step.run` (memoizado quando bem-sucedido) e salva em R2; a própria
 * `generateBook` marca o Book como READY. `onFailure` marca FAILED.
 */
export const bookGenerate = inngest.createFunction(
  {
    id: "book-generate",
    triggers: [bookGenerateRequested],
    retries: 2,
    onFailure: async ({ event, error }) => {
      const { bookId } = event.data.event.data;
      await prisma.book
        .update({ where: { id: bookId }, data: { status: "FAILED" } })
        .catch(() => {});
      console.error(`[book-generate] falha em ${bookId}:`, error);
    },
  },
  async ({ event, step }) => {
    const { bookId } = event.data;
    const key = await step.run("render-and-upload", () => generateBook(bookId));
    return { bookId, key };
  },
);

/**
 * Geração do Catálogo PDV em PDF (Trade Marketing).
 *
 * Disparada por `trade-catalog/generate.requested`. Mesmo pipeline do
 * `bookGenerate` acima: `step.run` memoizado, `generateTradeCatalogPdf` marca
 * READY, `onFailure` marca FAILED.
 */
export const tradeCatalogGenerate = inngest.createFunction(
  {
    id: "trade-catalog-generate",
    triggers: [tradeCatalogGenerateRequested],
    retries: 2,
    onFailure: async ({ event, error }) => {
      const { catalogId } = event.data.event.data;
      await prisma.tradeCatalog
        .update({ where: { id: catalogId }, data: { status: "FAILED" } })
        .catch(() => {});
      console.error(`[trade-catalog-generate] falha em ${catalogId}:`, error);
    },
  },
  async ({ event, step }) => {
    const { catalogId } = event.data;
    const key = await step.run("render-and-upload", () =>
      generateTradeCatalogPdf(catalogId),
    );
    return { catalogId, key };
  },
);

/**
 * Alerta de queda de preço para o app do cliente.
 *
 * Disparada por `shopper/price.changed` (de `products.update`). Notifica os
 * favoritos com queda real e deduplica por `lastNotifiedPrice`.
 */
export const shopperPriceAlert = inngest.createFunction(
  { id: "shopper-price-alert", triggers: [shopperPriceChanged], retries: 2 },
  async ({ event, step }) => {
    const { productId, newPrice } = event.data;
    return step.run("notify-favorites", () =>
      runShopperPriceAlert({ productId, newPrice }),
    );
  },
);

/**
 * Agendador do sync de ERP externo.
 *
 * Não sincroniza nada: lista as organizações com ERP configurado e dispara um
 * evento por org, para que a falha de um cliente não contamine os outros.
 *
 * Cadência calculada para o consumo do Inngest (ver `docs/` do módulo):
 * 15 em 15 min, das 6h às 22h, de segunda a sábado. Domingo fica de fora porque
 * a base não vende no domingo — conferido nos dados: 19/07/2026 não tem uma
 * linha de pedido faturado. Isso dá ~68 execuções/dia contra 96 de um cron 24/7,
 * e ~1.800 disparos/mês em vez de ~2.900.
 */
export const erpSyncSchedule = inngest.createFunction(
  {
    id: "erp-sync-schedule",
    triggers: [{ cron: "TZ=America/Fortaleza 0,15,30,45 6-22 * * 1-6" }],
  },
  async ({ step }) => {
    const organizationIds = await step.run("list-orgs", () =>
      listOrganizationsForSync(),
    );
    if (organizationIds.length === 0) return { dispatched: 0 };

    await step.sendEvent(
      "dispatch",
      organizationIds.map((organizationId) =>
        erpSyncRequested.create({ organizationId, windowDays: 7 }),
      ),
    );
    return { dispatched: organizationIds.length };
  },
);

/**
 * Passada profunda noturna.
 *
 * A janela curta do cron de 15 min não enxerga mudança tardia — pedido
 * cancelado semanas depois, ou faturado fora do prazo. Uma vez por dia relê 90
 * dias para o espelho não divergir devagar da origem.
 */
export const erpSyncDeepSchedule = inngest.createFunction(
  {
    id: "erp-sync-deep-schedule",
    triggers: [{ cron: "TZ=America/Fortaleza 0 3 * * *" }],
  },
  async ({ step }) => {
    const organizationIds = await step.run("list-orgs", () =>
      listOrganizationsForSync(),
    );
    if (organizationIds.length === 0) return { dispatched: 0 };

    await step.sendEvent(
      "dispatch",
      organizationIds.map((organizationId) =>
        erpSyncRequested.create({ organizationId, windowDays: 90 }),
      ),
    );
    return { dispatched: organizationIds.length };
  },
);

/**
 * Executa o sync de uma organização.
 *
 * `concurrency` por org evita que o botão "Atualizar agora" e o cron rodem em
 * cima um do outro e briguem pela mesma janela de datas. `onFailure` já é
 * coberto por `runErpSync`, que grava o erro na conexão antes de propagar.
 */
export const erpSyncRun = inngest.createFunction(
  {
    id: "erp-sync-run",
    triggers: [erpSyncRequested],
    retries: 3,
    concurrency: { key: "event.data.organizationId", limit: 1 },
  },
  async ({ event, step }) => {
    const { organizationId, windowDays } = event.data;
    return step.run("sync", () => runErpSync(organizationId, { windowDays }));
  },
);

/**
 * Cron dos alertas do dashboard.
 *
 * Roda a cada 5 minutos entre 6h e 22h em dias úteis (mesma janela do
 * `erpSyncSchedule`). Cada execução verifica TODOS os widgets com alerta
 * habilitado — a fan-out é interna à função para não pagar por N funções
 * agendadas separadamente (Inngest cobra por definição, não por linha).
 *
 * A tolerância de disparo é de ~6 min por padrão (ver
 * `ALERT_TOLERANCE_MINUTES`): o alerta configurado para 14h aceita cron
 * batendo até 14:06 — cobre a granularidade de 5 min sem duplicar disparo
 * (o `lastFiredAt` deduplica no mesmo dia).
 *
 * Se ninguém tiver alerta habilitado, a função sai em <10ms — barato o
 * suficiente para o cron rodar mesmo em orgs sem uso do módulo.
 */
export const dashboardAlertCheck = inngest.createFunction(
  {
    id: "dashboard-alert-check",
    triggers: [{ cron: "TZ=America/Fortaleza */5 6-22 * * 1-6" }],
  },
  async ({ step }) => {
    const fired = await step.run("check", () => checkWidgetAlerts());
    return { fired: fired.length };
  },
);

export const functions = [
  syncNasaDelivery,
  productImportProcess,
  supplierImportProcess,
  customerImportProcess,
  storeImportProcess,
  bookGenerate,
  tradeCatalogGenerate,
  shopperPriceAlert,
  erpSyncSchedule,
  erpSyncDeepSchedule,
  erpSyncRun,
  dashboardAlertCheck,
];
