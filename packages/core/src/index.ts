export * from "./types";
export * from "./local-catalog";
export * from "./sync";
export * from "./connectivity";
// Adapter web (default). O SQLite (nativo) fica no subpath "@nerp/core/sqlite"
// para não arrastar `@tauri-apps/plugin-sql` para o bundle do browser.
export { createIndexedDbCatalog } from "./adapters/indexeddb-catalog";
export * from "./outbox";
export { createIndexedDbOutbox } from "./adapters/indexeddb-outbox";
// Domínio de pagamento (ports & adapters). O mock não tem dep nativa, então
// entra no barrel; adapters reais (TEF/adquirente) irão por subpath depois.
export * from "./payment";
export * from "./payment-processor";
export * from "./sale";
export { createMockPaymentProcessor } from "./adapters/mock-payment-processor";
export type {
  MockOutcome,
  MockPaymentProcessorConfig,
} from "./adapters/mock-payment-processor";
// Domínio de caixa (sessão). Store SQLite (nativo) fica no subpath
// "@nerp/core/sqlite-cash-session".
export * from "./cash-session";
export * from "./cash-session-store";
export { createIndexedDbCashSessionStore } from "./adapters/indexeddb-cash-session";
