# @nerp/desktop — NERP Caixa (Tauri + Vite + React)

App desktop do PDV. **MVP (Fases 0→4):** parear o terminal, vender online **e
offline**, sincronizar sem perder/duplicar, conectividade honesta e recuperação
de falhas. **Fase 5:** app nativo Tauri compilando e gerando instalador Windows
(`.msi` + NSIS), com SQLite/store reais ligados. Ver `specs/desktop-offline.md`.

## Como rodar

### Como página web (dev rápido, sem Rust)

O frontend é uma SPA comum — roda no navegador, o mesmo código que a webview
do Tauri executa. É assim que se desenvolve/verifica sem toolchain nativa; nesse
modo o storage é IndexedDB + localStorage (os adapters SQLite/plugin-store só
entram no app nativo, por `isNative()`).

```bash
# 1) suba o backend (na raiz do monorepo), liberando a origem do desktop:
DESKTOP_ALLOWED_ORIGINS="http://localhost:5173" pnpm --filter @nerp/web dev

# 2) suba o desktop apontando para o backend:
VITE_NERP_API_URL="http://localhost:3000" pnpm --filter @nerp/desktop dev
# abre http://localhost:5173
```

### Como app nativo (Tauri) — funcional desde a Fase 5

Exige a **toolchain Rust** (`rustup`) — ver https://tauri.app/start/prerequisites.
Os ícones já estão gerados em `icons/` (regerar com `tauri icon <logo.png>`).

```bash
pnpm --filter @nerp/desktop tauri:dev     # janela nativa em dev (HMR do Vite)
pnpm --filter @nerp/desktop tauri:build   # release + instalador por SO
pnpm --filter @nerp/desktop release:win   # idem, só nsis + msi (o que se publica)
```

O build produz, no Windows:
- `src-tauri/target/release/bundle/msi/NERP Caixa_<versão>_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/NERP Caixa_<versão>_x64-setup.exe`

As origens da webview do Tauri (`tauri://localhost`, `http(s)://tauri.localhost`)
são **embutidas** na allowlist do backend (`apps/web/src/lib/desktop-cors.ts`) —
não precisam entrar no `DESKTOP_ALLOWED_ORIGINS`. Essa variável só existe para
origens extras, como o `http://localhost:5173` do modo web em dev.

## Build de release e publicação

A URL do backend é assada em build-time. O release usa `.env.production`
(versionado, com `https://nerp.nasaex.com`), e o `vite.config.ts` **quebra o
build de produção** se a variável sumir ou apontar para localhost — foi assim
que um instalador já saiu apontando para `localhost:3000`.

Para um build contra outro servidor, a variável na linha de comando vence:

```bash
VITE_NERP_API_URL="https://homolog.exemplo.com" pnpm --filter @nerp/desktop release:win
```

Publicar (upload no R2 + manifesto que a página `/aplicativos` do web lê):

```bash
cd ../web
npx tsx scripts/publish-desktop-release.ts \
  --file "../desktop/src-tauri/target/release/bundle/nsis/NERP Caixa_0.1.0_x64-setup.exe" \
  --version 0.1.0 \
  --notes "Primeira versão pública de testes."
```

Bumpar versão exige mexer em **dois** arquivos: `package.json` e
`src-tauri/tauri.conf.json`. Detalhes e o que ainda falta (assinatura de código,
auto-update): `specs/desktop-release.md`.

## Estrutura

- `src/lib/platform.ts` — `isNative()` (helper oficial `isTauri()` do
  `@tauri-apps/api`) decide SQLite/plugin-store × IndexedDB/localStorage.
- `src/lib/client.ts` — cliente oRPC tipado pelo contrato `DesktopApi` (`@nerp/api`).
- `src/lib/token-store.ts` — sessão do device (web = localStorage; nativo = plugin-store).
- `src/features/login` — pareamento por credenciais (`device.pairWithCredentials`).
- `src/features/pdv` — catálogo local, carrinho, venda offline e dead-letter.
- `src-tauri/` — shell nativo (Rust). Plugins `sql` (sqlite) e `store` registrados
  em `src/lib.rs`; permissões em `capabilities/default.json`. **Compila e empacota.**

## Banco local e sessão no nativo (ligados na Fase 5)

- **SQLite** (`@nerp/core/sqlite`) para catálogo e outbox; **plugin-store** para a
  sessão. Ambos carregados por import dinâmico só quando `isNative()`, então não
  entram no bundle web (viram chunks lazy separados).
- Wiring nativo já feito:
  - `Cargo.toml`: `tauri-plugin-sql` (feature `sqlite`) + `tauri-plugin-store`.
  - `src/lib.rs`: `.plugin(tauri_plugin_sql::Builder::default().build())` e o do store.
  - `capabilities/default.json`: `sql:default` **+ `sql:allow-execute`** (o default
    do sql NÃO cobre execute) + `store:default`.
- O SQL cru dos adapters é testado contra um SQLite real (`node:sqlite`) em
  `packages/core/src/adapters/sqlite-adapters.test.ts` — o caminho nativo é
  verificado, não só compilado.

## Tipagem do contrato (Fase 5)

O desktop consome um contrato hand-authored (`DesktopApi` em `@nerp/api`) em vez
de inferir `RouterClient<AppRouter>`: o tipo do router é grande demais para o TS
serializar num `.d.ts` (TS7056). O drift é impedido por um guard de conformidade
em `apps/web/src/lib/desktop-contract-conformance.ts` — se uma procedure usada
pelo desktop mudar de forma sem atualizar o contrato, o `check-types` do web
quebra.

## Endurecimento (Fase 4)

- **Conectividade real:** o indicador Online/Offline reflete o alcance do
  servidor (ping em `/api/health`), não só `navigator.onLine`. Pendências drenam
  ao reconectar e por timer.
- **Dead-letter:** venda que esgota as tentativas de sync vira "com falha"
  visível, com retry manual.

## Em aberto (nativo / próximos)

- **Keychain criptografado:** hoje o token fica no plugin-store (app-data, não
  criptografado). Upgrade: `tauri-plugin-stronghold`.
- **Auto-update:** exige assinatura + endpoint de releases:
  1. `pnpm --filter @nerp/desktop tauri signer generate` → par de chaves.
  2. `tauri.conf.json` → `plugins.updater` com `pubkey` + `endpoints`.
  3. `Cargo.toml`: `tauri-plugin-updater = "2"`; `lib.rs`: registrar o plugin.
  4. Publicar bundles + `latest.json` no endpoint (CI do `tauri build`).
  Não configurado aqui porque exige as chaves/infra de distribuição.
