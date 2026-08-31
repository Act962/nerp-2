# Frente de Caixa (PDV) — Sessão de caixa + níveis de usuário

> Sessão de caixa (abertura/fechamento/sangria/suprimento) e nível operador/caixa sobre o PDV que já existe.
> Feature: `src/features/caixa` (novo) + `src/app/router/caixa` (novo) + `src/app/(main)/(rest)/vendas/caixa` (novo) · reaproveita `src/features/sales`, `src/lib/permissions.ts`
> Criado em: 2026-08-08 · Atualizado em: 2026-08-08
> Status: 📋 Planejado (detalhado)

---

## Situacao atual

O PDV existe em `/vendas/novo` (feature `src/features/sales`, models `Sale`/`SaleItem`), mas **não há sessão de caixa** (abertura/fechamento/sangria/suprimento) nem **nível de usuário operador/caixa** — só existe owner/admin/member + chaves de permissão por página. Duas falhas no fluxo de venda atual: `src/app/router/sales/create.ts` deriva `saleNumber` de `prisma.sale.count()` (corrida contra o `@@unique([organizationId, saleNumber])`) e **não baixa estoque nem cria `StockMovement`/lançamento financeiro**.

Arquivos principais:
- `src/app/router/sales/create.ts` — criação da venda (a reescrever)
- `src/features/sales/components/novo/create-sale/index.tsx` — tela do PDV
- `src/lib/permissions.ts` — `PAGE_PERMISSIONS`/`ACTION_PERMISSIONS` + `memberHasPermission`/`memberCan`
- `src/features/configuracoes/components/permissions-panel.tsx` — painel que já renderiza `ASSIGNABLE_PERMISSIONS`
- `prisma/schema.prisma` — `Sale`, `SaleItem`, `Organization`, `FinancialAccount` (type CAIXA), `Transaction`, `StockMovement`

---

## Pendencias

### Critico

- [ ] **Numeração de venda com corrida** (`sales/create.ts`) — trocar `sale.count()+1` por contador atômico `Organization.lastSaleNumber` (`update … { increment: 1 }`) dentro da transação.
- [ ] **Venda não baixa estoque** (`sales/create.ts`) — por item, criar `StockMovement` (tipo `VENDA`, `previousStock`/`newStock`/`saleId`) e decrementar `Product.currentStock`; setar `createdById` (hoje nunca setado).

### Funcional

- [ ] **Models de sessão** (`prisma/schema.prisma`) — `CashSession` (`cash_sessions`) + `CashMovement` (`cash_movements`) + enums `CashSessionStatus`/`CashMovementType`; `Sale.cashSessionId?`.
- [ ] **1 sessão aberta por operador** — índice parcial no SQL da migration: `CREATE UNIQUE INDEX … ON "cash_sessions" ("organizationId","memberId") WHERE status = 'OPEN'` + guard no handler.
- [ ] **Procedures** (`src/app/router/caixa/*`) — `abrir`, `fechar` (contagem cega: esperado × contado × diferença), `sangria`, `suprimento`, `current`, `list`, `movements` + `_access.ts`; registrar em `router/index.ts`.
- [ ] **Amarrar venda à sessão** — bloquear `sales/create.ts` sem caixa aberto; anexar `cashSessionId`; criar `CashMovement` `VENDA` com `paymentMethod`/`amount`.
- [ ] **Dados de cartão em `SalePayment`** (`prisma/schema.prisma:1232`) — hoje guarda só `method`/`amount`/`saleId`. Sem `acquirer`, `nsu`, `authorizationCode`, `brand`, `installments` e `terminalId` não existe chave para casar venda × liquidação da adquirente, e a conciliação de cartão fica limitada ao agregado do dia. Bloqueia a Fase 2 de [`integracoes-catalogo-financeiro.md`](./integracoes-catalogo-financeiro.md).
- [ ] **Níveis operador/caixa** (`src/lib/permissions.ts`) — chave de página `caixa` + ações `caixa-abrir/fechar/sangria/suprimento` (aparecem automaticamente no painel de Configurações; carry-over no convite já existe).

### UX

- [ ] **UI da sessão** (`src/features/caixa/*`) — dialogs de abrir/fechar (contagem cega + resumo), sangria/suprimento (gated por `memberCan`), resumo da sessão, histórico (tabela à mão + cursor), `caixa-status-badge` no header do PDV.
- [ ] **Página + menu** — `src/app/(main)/(rest)/vendas/caixa/page.tsx` (`requirePermission("caixa")`) + item na sidebar sob "Frente de caixa".
- [ ] **Gate no PDV** — sem caixa aberto, desabilitar checkout e oferecer "Abrir caixa".

### Qualidade de codigo

- [ ] Converter `Decimal→Number` e `Date→ISO` na fronteira dos handlers; erros sempre via objeto `errors`; toda query filtrando `organizationId`.

---

## Decisoes tomadas

- **Nível de usuário = CHAVES de permissão, não novo cargo** — reaproveita o painel de Configurações → Permissões (`ASSIGNABLE_PERMISSIONS`), zero migration/carry-over. Evita brigar com o `role` fixo do Better Auth (mesma razão do `TradeRole`).
- **`CashMovement` próprio, não `Transaction`** — `Transaction` é contas a pagar/receber (exige `accountId`/`category`/`dueDate`); a sessão precisa de um livro leve. Reconciliação com `FinancialAccount(CAIXA)` fica para depois.
- **Numeração via `Organization.lastSaleNumber`** (increment atômico) — mais barato que um model de sequência; mantém o `@@unique` como backstop.
- **Página aninhada em `/vendas/caixa`** — já dentro da allowlist do `middleware.ts`, não exige editá-lo.

---

## Proximos passos

1. Schema (models + enums + `Sale.cashSessionId` + `Organization.lastSaleNumber`).
2. Migration **manual + `migrate deploy`** (ver `specs/` nota de drift `cosmos_*`) + `prisma generate` + bump `SCHEMA_VERSION` em `src/lib/db.ts`.
3. Chaves de permissão + procedures `caixa/*`.
4. Reescrever `sales/create.ts` (sessão + estoque + numeração).
5. UI da feature `caixa` + página + sidebar.

---

## Melhorias futuras (nao urgentes)

- [ ] Reconciliar total em dinheiro no `FinancialAccount(CAIXA)`/`Transaction` no fechamento.
- [ ] Preset de nível "operador"/"caixa" no painel (marca o conjunto de chaves de uma vez).
- [ ] Relatório de diferenças de caixa por operador/período.
