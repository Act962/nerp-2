# Desktop — Fase 3: escrita de venda offline (implementado)

> O marco central do offline: o caixa **vende sem internet**. A venda vai para uma outbox local (nunca se perde) e é replicada no server ao reconectar, que atribui o número oficial. Idempotente.
> Feature: `packages/core` (outbox) · `sales.createFromDevice` (novo procedure) · `apps/desktop` (carrinho + venda)
> Criado em: 2026-08-18 · Atualizado em: 2026-08-18
> Status: ✅ Implementado na branch `feat/desktop-fase-3` (parte de `feat/desktop`).

---

## O que foi entregue

**Servidor (aditivo):**
- `Sale.clientOperationId @unique` (migration) — chave de idempotência do replay.
- `sales.createFromDevice` — replay idempotente por `operationId`; grava os preços **capturados no device** (venda é fato consumado, não re-resolve nem rejeita por divergência); atribui `saleNumber` atômico; baixa estoque **permitindo furar** (advisory). Escopado pela org do device.

**`@nerp/core`:**
- `Outbox` (interface) + adapters IndexedDB e SQLite (nativo, import dinâmico).
- `drainOutbox(outbox, replay)` — drena FIFO; sucesso → `done` (guarda o `saleNumber`); falha transitória → mantém `pending`, incrementa `attempts` e para; esgotou tentativas → dead-letter (`failed`) sem travar as próximas.

**Desktop:** carrinho no PDV (adicionar item, qtd, total); **Finalizar venda** grava na outbox local (funciona offline) e drena quando há rede; indicador **"N por sincronizar"**.

## Decisões tomadas

- **Venda offline é fato consumado** — o server grava os preços do device e só atribui número + baixa estoque; não re-resolve preço (isso é regra da venda online `sales.create`).
- **Idempotência por `clientOperationId @unique`**, não tabela de ledger — mais simples; o `@unique` cobre a corrida de dois replays (P2002 → devolve a venda existente).
- **Estoque advisory offline** — a baixa pode furar (negativo); a divergência fica no `StockMovement` para reconciliar. O caixa nunca é bloqueado por estoque.
- **`cashSessionId` fica null** na venda offline — a venda existe sem sessão de caixa (o campo já é opcional). Reconciliação com caixa é follow-up.

## Verificação (tudo verde)

- `pnpm check-types` (8 workspaces) · lint · build (SQLite catalog+outbox em chunks lazy).
- Unit `@nerp/core` `outbox.test.ts` (3): drena tudo; falha transitória (retry); dead-letter sem travar a fila.
- Integração `sales-create-from-device.test.ts` (3): cria venda + número + baixa estoque; **idempotente** (replay não duplica nem baixa de novo); não vende produto de outra org.
- **Navegador** (desktop × web, DB local):
  - venda **online**: carrinho → Finalizar → `createFromDevice` 200 → venda **#1**, estoque baixou (oversell permitido);
  - venda **offline** (servidor derrubado): Finalizar → outbox **pending**, badge **"1 por sincronizar"**, carrinho limpa;
  - reconecta + Sincronizar → drena → server atribui **#2** → outbox `done`, badge some;
  - banco com **exatamente 2 vendas**, numeração sequencial, **zero duplicata**.

## Próximo passo

Com Fases 0–3, o **mínimo do app desktop** (parear, vender online e offline, sincronizar) está fechado. Candidatos para fechar o MVP / Fase 4:
- Reconciliação de caixa (sessão) e recibo/consulta de venda offline.
- Sync de remoções/preços-por-tabela/estoque no catálogo.
- Endurecimento: keychain do token, auto-update do Tauri, storage seguro, ligar o SQLite nativo.

## Em aberto

- [ ] Sessão de caixa espelhada offline (hoje a venda vai sem `cashSessionId`).
- [ ] `pingBackend` no lugar de só `navigator.onLine` (o drain tenta e falha rápido, mas o indicador diz "Online" com servidor fora).
- [ ] UI de dead-letter (vendas `failed` após esgotar tentativas) para o operador.
