import { isTauri } from "@tauri-apps/api/core";

export type Platform = "windows" | "macos" | "linux";

// No Tauri o certo seria a API nativa de SO; para a Fase 1 (que roda tanto no
// navegador quanto na webview) inferir do userAgent basta.
export function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux") || ua.includes("android")) return "linux";
  return "windows";
}

/**
 * Roda dentro da webview do Tauri (app nativo) vs. navegador/dev.
 *
 * Usa o helper oficial `isTauri()` do `@tauri-apps/api/core` — o Tauri v2 injeta
 * `window.isTauri` sempre, mesmo sem `withGlobalTauri`. A checagem antiga por
 * `"__TAURI__" in window` era um bug latente: `__TAURI__` só existe com
 * `withGlobalTauri: true`, então o app nativo cairia SILENCIOSAMENTE no
 * IndexedDB/localStorage em vez do SQLite/plugin-store. É o gate que decide,
 * nos três pontos (catálogo, outbox, token), qual storage entra por baixo.
 */
export function isNative(): boolean {
  return isTauri();
}
