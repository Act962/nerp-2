export type Platform = "windows" | "macos" | "linux";

// No Tauri o certo seria a API nativa de SO; para a Fase 1 (que roda tanto no
// navegador quanto na webview) inferir do userAgent basta.
export function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux") || ua.includes("android")) return "linux";
  return "windows";
}
