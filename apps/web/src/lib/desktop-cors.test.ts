import { afterEach, describe, expect, it, vi } from "vitest";
import { desktopCorsHeaders } from "./desktop-cors";

afterEach(() => vi.unstubAllEnvs());

describe("desktopCorsHeaders", () => {
  it("libera origin que está na allowlist", () => {
    vi.stubEnv(
      "DESKTOP_ALLOWED_ORIGINS",
      "https://tauri.localhost,tauri://localhost",
    );
    const headers = desktopCorsHeaders("https://tauri.localhost");
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://tauri.localhost",
    );
    // device usa bearer, não cookie — credenciais cross-origin ficam desligadas
    expect(headers["Access-Control-Allow-Credentials"]).toBe("false");
  });

  it("ignora origin fora da allowlist (web same-origin não vaza CORS)", () => {
    vi.stubEnv("DESKTOP_ALLOWED_ORIGINS", "https://tauri.localhost");
    expect(desktopCorsHeaders("https://outro.site")).toEqual({});
  });

  it("ignora quando não há Origin", () => {
    vi.stubEnv("DESKTOP_ALLOWED_ORIGINS", "https://tauri.localhost");
    expect(desktopCorsHeaders(null)).toEqual({});
  });

  // Regressão do bug de distribuição: o app instalado no Windows manda
  // `http://tauri.localhost`, e um ambiente que só listou a variante https
  // bloqueia o pareamento do terminal. As origens da webview do Tauri são
  // embutidas justamente para não depender da configuração do deploy.
  it.each([
    "http://tauri.localhost",
    "https://tauri.localhost",
    "tauri://localhost",
  ])("libera %s sem nenhuma allowlist configurada", (origin) => {
    vi.stubEnv("DESKTOP_ALLOWED_ORIGINS", "");
    expect(desktopCorsHeaders(origin)["Access-Control-Allow-Origin"]).toBe(
      origin,
    );
  });

  it("origem embutida não abre a porta para o resto", () => {
    vi.stubEnv("DESKTOP_ALLOWED_ORIGINS", "");
    expect(desktopCorsHeaders("http://tauri.localhost.evil.com")).toEqual({});
  });
});
