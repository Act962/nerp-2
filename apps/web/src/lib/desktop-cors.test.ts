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
});
