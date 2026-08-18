import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// SPA do desktop. Roda no navegador em dev (mesmo código da webview do Tauri) e
// é empacotada como assets estáticos que o Tauri serve. `strictPort` garante a
// origem fixa (localhost:5173) que precisa estar na allowlist de CORS/origens.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { outDir: "dist" },
});
