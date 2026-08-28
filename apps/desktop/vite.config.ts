import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// SPA do desktop. Roda no navegador em dev (mesmo código da webview do Tauri) e
// é empacotada como assets estáticos que o Tauri serve. `strictPort` garante a
// origem fixa (localhost:5173) que precisa estar na allowlist de CORS/origens.
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, __dirname, "VITE_");
  const apiUrl = env.VITE_NERP_API_URL ?? "";

  // A URL do backend é assada no bundle (decisão de `src/lib/config.ts`): um
  // build por ambiente. O modo de falha é silencioso e caro — o instalador sai
  // apontando para `localhost:3000` e só aparece na máquina do cliente, como
  // "não consigo parear". Quebrar o build aqui é o único ponto em que dá para
  // pegar isso antes de distribuir.
  if (command === "build" && mode === "production") {
    if (!apiUrl) {
      throw new Error(
        "VITE_NERP_API_URL não definida. O build de produção precisa da URL do backend (veja apps/desktop/.env.production).",
      );
    }
    if (/localhost|127\.0\.0\.1/.test(apiUrl)) {
      throw new Error(
        `VITE_NERP_API_URL aponta para ${apiUrl}. Um build de produção com URL local gera um instalador que não acha o servidor.`,
      );
    }
  }

  return {
    plugins: [react()],
    clearScreen: false,
    server: { port: 5173, strictPort: true },
    build: { outDir: "dist" },
  };
});
