export * from "./types";
export * from "./local-catalog";
export * from "./sync";
export * from "./connectivity";
// Adapter web (default). O SQLite (nativo) fica no subpath "@nerp/core/sqlite"
// para não arrastar `@tauri-apps/plugin-sql` para o bundle do browser.
export { createIndexedDbCatalog } from "./adapters/indexeddb-catalog";
