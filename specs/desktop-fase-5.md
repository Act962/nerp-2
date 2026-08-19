# Desktop — Fase 5: app nativo real + guard de tipos (implementado)

> Com o Rust instalado, o que antes era "escrito mas não-rodável" virou app
> nativo de verdade: compila, liga SQLite/store, empacota instalador Windows. E o
> contrato do desktop ganhou um guard de conformidade que quebra o build do
> servidor no drift.
> Feature: `apps/desktop/src-tauri` (plugins nativos) · `@nerp/core` (teste SQLite real) · `@nerp/api` (contrato + guard no `apps/web`)
> Criado em: 2026-08-19 · Atualizado em: 2026-08-19
> Status: ✅ Implementado na branch `feat/desktop-fase-5` (parte de `feat/desktop`).

---

## O que foi entregue

**App nativo compilando e empacotando (o grande marco):**
- Detecção de nativo corrigida: `isNative()` central usa o `isTauri()` oficial do
  `@tauri-apps/api`. A checagem antiga `"__TAURI__" in window` era um bug latente
  — `__TAURI__` só existe com `withGlobalTauri`, então o app nativo cairia
  **silenciosamente** no IndexedDB/localStorage em vez do SQLite/plugin-store.
- Plugins ligados no Rust: `tauri-plugin-sql` (feature `sqlite`) e
  `tauri-plugin-store`, registrados em `src/lib.rs`.
- Permissões: `capabilities/default.json` com `sql:default` **+ `sql:allow-execute`**
  (o default do sql cobre só load/select/close — sem execute, toda escrita seria
  negada em runtime) + `store:default`.
- Ícones gerados (`tauri icon`) — `icon.ico`/`icon.icns` que o `tauri-build` exige.
- `cargo build` → `nerp-desktop.exe`; `tauri build` → **instaladores Windows**
  (`.msi` via WiX + `-setup.exe` via NSIS).

**Caminho nativo verificado, não só compilado:**
- `packages/core/src/adapters/sqlite-adapters.test.ts` roda o SQL cru dos adapters
  (`sqlite-catalog`/`sqlite-outbox`) contra um **SQLite real** (`node:sqlite`),
  mockando o `@tauri-apps/plugin-sql`. Cobre upsert/busca/cursor/watermark,
  enqueue/pending/dead-letter e `drainOutbox` (sucesso e esgotamento de tentativas).

**Guard de tipos do contrato (no lugar da inferência total):**
- `@nerp/api` passa a exportar o contrato `DesktopApi` (movido do desktop).
- `apps/web/src/lib/desktop-contract-conformance.ts` afirma, em tempo de
  compilação, que `RouterClient<AppRouter>` satisfaz o `DesktopApi`. Drift de
  input/output numa procedure usada pelo desktop → `check-types` do WEB quebra
  com mensagem apontando `packages/api/src/contract.ts`.

## Decisões tomadas

- **Guard de conformidade em vez de emitir `.d.ts` do `AppRouter`.** A ideia
  original (desktop inferir `RouterClient<AppRouter>` de um `.d.ts`) esbarrou num
  limite DURO do TS: o tipo do `router` (55 entidades) é grande demais para
  serializar num `.d.ts` (**TS7056** + TS4023 "cannot be named"). Não há config
  que resolva — só anotar à mão o retorno de dezenas de procedures. O guard
  entrega o valor real (zero drift) sem a serialização inviável e mantém a
  compilação do desktop leve. Provado nos dois sentidos (positivo compila;
  contrato quebrado reprova o `check-types`).
- **`isTauri()` oficial, não `__TAURI_INTERNALS__` na mão.** Helper à prova de
  versão; não depende de `withGlobalTauri`.
- **`node:sqlite` para testar o SQL nativo.** SQLite de verdade embutido no Node
  (24+), sem dependência extra — exercita as mesmas queries do device.
- **Instalador `.msi` + NSIS (targets "all").** Os dois saem do mesmo build; o
  dev escolhe o de distribuição depois.
- **Ícones desktop-only.** Removidos os de Android/iOS/Store que o `tauri icon`
  gera, para o commit não virar 40 arquivos.

## Verificação (tudo verde)

- `check-types`: desktop, `@nerp/api`, `@nerp/core` e `apps/web` (com o guard) limpos.
- `test`: `apps/web` (20) + `@nerp/core` (10, incl. os 4 novos de SQLite real).
- `lint`: arquivos da fase limpos (a massa de CRLF do tree é pré-existente —
  `git add --renormalize .`, conforme CLAUDE.md).
- **Nativo:** `cargo build` → `nerp-desktop.exe` (17 MB); `tauri build` → `.msi`
  (4,3 MB) + `-setup.exe` NSIS (3,0 MB).
- **Guard com dentes:** quebrar `saleNumber: number → string` no contrato faz o
  `check-types` do web reprovar em `desktop-contract-conformance.ts` (revertido).

## Em aberto (próximos)

- [ ] Keychain criptografado do token (`tauri-plugin-stronghold`) no lugar do plugin-store.
- [ ] Auto-update do Tauri (assinatura + endpoint de releases + `latest.json`).
- [ ] Assinatura de código dos instaladores (certificado) para distribuição sem alerta do SO.
- [ ] Sessão de caixa offline; sync de remoções/preços-por-tabela/estoque; recibo offline.
