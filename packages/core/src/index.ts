/**
 * Barrel do `@nerp/core`: só DOMÍNIO, nenhum adapter de storage.
 *
 * Todo adapter carrega uma dependência de plataforma — `idb` (browser),
 * `@tauri-apps/plugin-sql` (nativo), amanhã `expo-sqlite` (React Native) — e
 * cada uma delas é lixo, ou erro de resolução, nas outras plataformas. Por isso
 * TODOS ficam em subpath (`@nerp/core/indexeddb`, `@nerp/core/sqlite`, …) e o
 * host escolhe o seu por import dinâmico.
 *
 * A simetria é o ponto: enquanto só o SQLite estava em subpath, importar o
 * barrel arrastava o IndexedDB para bundles que nunca teriam `indexedDB` —
 * problema que só apareceria no primeiro app React Native.
 */
export * from "./types";
export * from "./local-catalog";
export * from "./sync";
export * from "./connectivity";
export * from "./outbox";
// Domínio de pagamento (ports & adapters). O mock é a exceção à regra acima:
// não tem dependência de plataforma nenhuma, então entra no barrel. Adapters
// reais (TEF/adquirente) irão por subpath, como os de storage.
export * from "./payment";
export * from "./payment-processor";
export * from "./sale";
export { createMockPaymentProcessor } from "./adapters/mock-payment-processor";
export type {
  MockOutcome,
  MockPaymentProcessorConfig,
} from "./adapters/mock-payment-processor";
// Domínio de caixa (sessão).
export * from "./cash-session";
export * from "./cash-session-store";
