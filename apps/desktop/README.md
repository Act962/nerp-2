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


## Banco local (Fase 2)

O catálogo é cacheado localmente (`@nerp/core`): **IndexedDB** no navegador/dev,
**SQLite** no Tauri nativo. O PDV lê desse cache — funciona offline; sincroniza
por `products.pull` (incremental) quando online.

Para ligar o SQLite no nativo (ainda não feito — precisa do Tauri rodando):
1. `Cargo.toml`: `tauri-plugin-sql = { version = "2", features = ["sqlite"] }`.
2. `src-tauri/src/lib.rs`: `.plugin(tauri_plugin_sql::Builder::new().build())`.
3. `capabilities/default.json`: permissão `sql:default` (+ `sql:allow-execute`/`sql:allow-select`).
O adapter TS já está pronto em `@nerp/core/sqlite`.

## Endurecimento (Fase 4)

- **Conectividade real:** o indicador Online/Offline reflete o alcance do
  servidor (ping em `/api/health`), não só `navigator.onLine`. Pendências drenam
  ao reconectar e por timer.
- **Dead-letter:** venda que esgota as tentativas de sync vira "com falha"
  visível, com retry manual.
- **Sessão do token:** abstraída (`token-store.ts`). Web/dev = `localStorage`;
  nativo = `@tauri-apps/plugin-store` (arquivo app-data). Para ligar no nativo:
  1. `Cargo.toml`: `tauri-plugin-store = "2"`.
  2. `src-tauri/src/lib.rs`: `.plugin(tauri_plugin_store::Builder::new().build())`.
  3. `capabilities/default.json`: `store:default`.
  Upgrade de segurança (token criptografado no keychain do SO): trocar por
  `tauri-plugin-stronghold`.

### Auto-update (a fazer no nativo)

O updater do Tauri exige assinatura e um endpoint de releases:
1. `pnpm --filter @nerp/desktop tauri signer generate` → gera o par de chaves.
2. `tauri.conf.json` → `plugins.updater` com `pubkey` + `endpoints`.
3. `Cargo.toml`: `tauri-plugin-updater = "2"`; `lib.rs`: `.plugin(tauri_plugin_updater::Builder::new().build())`.
4. Publicar os bundles + `latest.json` no endpoint (CI do `tauri build`).
Não configurado aqui porque exige as chaves/infra de distribuição.
