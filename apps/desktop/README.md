# @nerp/desktop — NERP Caixa (Tauri + Vite + React)

App desktop do PDV. **Fase 1: online-only** — parear o terminal (login por
credenciais) e listar produtos pela API. Offline entra nas fases seguintes
(ver `specs/desktop-offline.md`).

## Como rodar

### Como página web (dev rápido, sem Rust)

O frontend é uma SPA comum — roda no navegador, o mesmo código que a webview
do Tauri executa. É assim que se desenvolve/verifica sem toolchain nativa.

```bash
# 1) suba o backend (na raiz do monorepo), liberando a origem do desktop:
DESKTOP_ALLOWED_ORIGINS="http://localhost:5173" pnpm --filter @nerp/web dev

# 2) suba o desktop apontando para o backend:
VITE_NERP_API_URL="http://localhost:3000" pnpm --filter @nerp/desktop dev
# abre http://localhost:5173
```

### Como app nativo (Tauri)

Exige a **toolchain Rust** (`rustup`) instalada — ver https://tauri.app/start/prerequisites.
Antes do primeiro build, gere os ícones (`icons/` está vazio):

```bash
pnpm --filter @nerp/desktop tauri icon caminho/para/logo.png
pnpm --filter @nerp/desktop tauri:dev     # janela nativa em dev
pnpm --filter @nerp/desktop tauri:build   # bundle por SO
```

Em produção, `DESKTOP_ALLOWED_ORIGINS` no backend precisa incluir a origem do
Tauri (`tauri://localhost` no macOS/Linux, `https://tauri.localhost` no Windows).

## Estrutura

- `src/lib/client.ts` — cliente oRPC tipado (`@nerp/api` + tipo `AppRouter`).
- `src/lib/token-store.ts` — guarda o token do device (Fase 1: localStorage; Fase 4: keychain).
- `src/features/login` — pareamento por credenciais (`device.pairWithCredentials`).
- `src/features/pdv` — busca de produtos online.
- `src-tauri/` — shell nativo (Rust). **Não compilado neste ambiente** (sem Rust).
