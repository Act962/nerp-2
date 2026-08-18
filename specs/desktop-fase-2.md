# Desktop — Fase 2: banco local + leitura offline (implementado)

> O desktop puxa o catálogo da API para um **banco local** e o PDV **lê desse banco** — funcionando offline. Sync incremental. Ainda **sem escrever** venda offline (Fase 3).
> Feature: `packages/core` (novo) · `products.pull` (novo procedure) · `apps/desktop` (PDV lê local)
> Criado em: 2026-08-18 · Atualizado em: 2026-08-18
> Status: ✅ Implementado na branch `feat/desktop-fase-2` (parte de `feat/desktop`).

---

## O que foi entregue

**`@nerp/core`** — motor offline, agnóstico de plataforma:
- `LocalCatalog` — interface do catálogo local (o único ponto de troca de storage).
- `createIndexedDbCatalog` (`idb`) — storage web/PWA e do dev (onde a Fase 2 é verificada).
- `createSqliteCatalog` (`@nerp/core/sqlite`, `@tauri-apps/plugin-sql`) — storage nativo (Tauri). Import dinâmico → **não entra no bundle web**.
- `syncCatalog(catalog, pull)` — orquestrador do sync incremental (keyset por `(updatedAt,id)`, persiste o watermark a cada página, retoma de onde parou).
- `connectivity` — `isOnline`, `pingBackend`, `onConnectivityChange`.

**Servidor (aditivo):** `products.pull` — sync incremental escopado por org do device; keyset cursor, devolve `{ products, cursor, hasMore }`.

**Desktop:** o PDV lê/busca no **catálogo local** (offline-capable); sincroniza em background quando online; indicador Online/Offline + "N itens · sync há…" + botão Sincronizar. O storage é escolhido em runtime (IndexedDB no browser, SQLite no Tauri).

## Decisões tomadas

- **Sync por operações via `products.pull`**, keyset `(updatedAt,id)` — estável com timestamps repetidos (importação em lote); upsert idempotente na borda.
- **Abstração `LocalCatalog` com dois adapters** — IndexedDB (verificado) e SQLite (nativo). Mesmo motor serve desktop e, depois, o PWA (`pdv-offline.md`).
- **SQLite via SQL cru parametrizado**, não Drizzle — para uma tabela de catálogo é mais simples e sem dep extra; Drizzle pode entrar por cima depois. (Desvio consciente do `desktop-offline.md §3.1`.)
- **Adapter SQLite por import dinâmico** — mantém `@tauri-apps/plugin-sql` fora do bundle web (confirmado: vira chunk lazy próprio).

## Verificação (tudo verde)

- `pnpm check-types` (8 workspaces) · lint · build do desktop (68 módulos; SQLite isolado num chunk lazy).
- Unit `@nerp/core` `sync.test.ts` (3): pagina todas as páginas + watermark; resume do cursor; página vazia.
- Integração `products-pull.test.ts` (3): primeira sync escopada por org; keyset sem repetir; incremental a partir do watermark.
- **Navegador** (desktop :5173 × web :3000, DB local):
  - sync inicial → `products/pull` 200 → **IndexedDB com 2 produtos + cursor + lastSyncedAt**;
  - **servidor derrubado** → reload → PDV **ainda lista** (IndexedDB) e a **busca filtra offline**;
  - produto novo no servidor → Sincronizar → o pull mandou o cursor salvo e voltou **só o produto novo** (incremental).

## Próximo passo

**Fase 3** — escrita offline: outbox de vendas + replay idempotente (server assigns numeração), sessão de caixa espelhada. Ver `specs/desktop-offline.md`.

## Em aberto

- [ ] Sync de **remoções/inativações** (hoje o pull só traz upserts; produto deletado no server não some do device).
- [ ] Sync de **preços por tabela/cliente e estoque** além do catálogo base.
- [ ] Ligar o adapter SQLite no nativo (Cargo + capability + `tauri.conf`) — passos no README do desktop.
- [ ] `pingBackend` no heartbeat (hoje o online é só `navigator.onLine`).
