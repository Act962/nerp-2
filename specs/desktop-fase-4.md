# Desktop — Fase 4: endurecimento (implementado)

> Robustez de PDV: conectividade que reflete o servidor de verdade, vendas que falham não somem (dead-letter + retry), sync automático, e abstração de storage seguro do token.
> Feature: `/api/health` · `@nerp/core` (reachability, outbox.failed) · `apps/desktop` (PDV endurecido, token-store abstraído)
> Criado em: 2026-08-18 · Atualizado em: 2026-08-18
> Status: ✅ Implementado na branch `feat/desktop-fase-4` (parte de `feat/desktop`).

---

## O que foi entregue

**Conectividade real:**
- `/api/health` (aditivo, com CORS do desktop, sem DB, `no-store`).
- `@nerp/core`: `pingBackend` agora bate no `/api/health`; `watchReachability` faz ping no boot, por timer e nos eventos do browser, notificando só na mudança.
- PDV: o badge Online/Offline reflete o **alcance real do servidor** (não só `navigator.onLine`); pendências drenam ao (re)conectar e por timer de 20s.

**Dead-letter:**
- `Outbox.failed()` nos adapters; `retrySale` re-arma (pending, attempts 0) e drena.
- PDV: badge "N com falha" + painel listando as vendas mortas com "Tentar de novo".

**Storage seguro do token (abstração):**
- `token-store.ts` vira interface `SessionStorage` com cache em memória (leitura async, `getCurrentToken()` síncrono para o cliente oRPC). Web/dev = `localStorage`; nativo = `@tauri-apps/plugin-store` (`tauri-session-storage.ts`, import dinâmico). App carrega a sessão de forma assíncrona no boot.

**Documentado (nativo, não-rodável sem Rust):** wiring do `plugin-store`, upgrade para keychain criptografado (Stronghold) e setup do **auto-update** do Tauri — ver README do desktop.

## Decisões tomadas

- **Ping em `/api/health`, não HEAD no `/api/rpc`** — endpoint dedicado, barato e previsível; `no-store` para o cache não mascarar uma queda.
- **`watchReachability` só notifica na mudança** — evita re-render/sync a cada ping.
- **Cache em memória do token** — a leitura do storage pode ser async (keychain), mas o cliente oRPC lê o token síncrono, sem I/O por request.
- **Retry manual do dead-letter** — depois de esgotar as tentativas automáticas, a decisão de retentar é do operador (a causa costuma exigir ação, ex.: produto removido).

## Verificação (tudo verde)

- `pnpm check-types` (8 workspaces) · lint · build (plugin-store/SQLite isolados em chunks lazy).
- Testes `@nerp/core` (6) e integração (15) seguem passando.
- **Navegador** (desktop :5175 × web, DB local):
  - badge **Online** via ping em `/api/health` (não só `navigator.onLine`);
  - **servidor derrubado**: `navigator.onLine` **true**, mas o badge vira **Offline** (ping falha) — o diferencial da fase;
  - **dead-letter**: venda com `status: failed` injetada → badge "1 com falha" + painel + "Tentar de novo"; retry → reprocessa → vira `done` com número do server, badge some.

## MVP do desktop — fechado

Fases 0→4 entregam parear, vender online **e offline**, sincronizar sem perder/duplicar, conectividade honesta e recuperação de falhas. `feat/desktop` está pronto para virar PR na `main`.

## Em aberto (nativo / próximos)

- [ ] Ligar `plugin-store`, keychain criptografado (Stronghold) e auto-update no build Tauri (precisa de Rust + chaves de assinatura).
- [ ] Sessão de caixa espelhada offline; sync de remoções/preços-por-tabela/estoque.
- [ ] Recibo/consulta de venda offline; métricas de tempo offline.
