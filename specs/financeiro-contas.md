# Financeiro — Contas a pagar/receber (port do nasaex-wey)

> Contas a pagar/receber, régua de cobrança e fluxo de caixa, espelhando o ledger do módulo Payment do `nasaex-wey`.
> Feature: `src/features/financeiro` (novo) + `src/app/router/financeiro` (novo) + `src/app/(main)/(rest)/financeiro` (novo)
> Criado em: 2026-08-08 · Atualizado em: 2026-08-08
> Status: 📋 Planejado (esboço)

---

## Situacao atual

O nerp-2 já tem os models `FinancialAccount` e `Transaction` (contas, receita/despesa, recorrência) **sem router nem UI** — nenhuma tela de contas a pagar/receber. O `nasaex-wey` tem um ledger mais completo (parcelas, régua de cobrança, aprovações, dashboard/fluxo de caixa) que pode ser portado e conciliado com os models existentes.

Fonte a espelhar (`/Users/weydsonlima/nasaex-wey`):
- `src/features/payment/*` — UI (entries, dashboard, cashflow, contatos, dunning, aprovações)
- `src/app/router/payment/*` — procedures (`entries`, `accounts`, `categories`, `contacts`, `dashboard`, `dunning`, `approvals`)
- `src/inngest/functions/payment/*` — jobs de régua/aprovação
- Models: `PaymentEntry`, `PaymentBankAccount`, `PaymentCategory`, `PaymentContact`, dunning/aprovação/governança

---

## Pendencias

### Funcional

- [ ] **Conciliar com o schema existente** — mapear `PaymentEntry`/`PaymentBankAccount` sobre `Transaction`/`FinancialAccount` (evitar duplicar o conceito de conta/lançamento) OU migrar de vez para o modelo portado, decidindo um só.
- [ ] **Procedures** — contas a pagar/receber (list/create/update/pay/delete), contas bancárias, categorias/centros de custo, contatos, dashboard + fluxo de caixa.
- [ ] **Régua de cobrança (dunning)** — jobs via Inngest (padrão de status + evento já usado no nerp-2).
- [ ] **Reconciliação com o caixa** (`pdv-caixa`) — fechamento e vendas em dinheiro/cartão lançam em contas a receber / `PaymentEntry`.

### UX

- [ ] Páginas: contas a pagar, contas a receber, fluxo de caixa; formulários no padrão `Field`/`FieldGroup` (rhf + zodResolver).
- [ ] Item na sidebar + chave de permissão de página (`financeiro`).

### Qualidade de codigo

- [ ] Decidir se porta a camada `requirePaymentAccess` (PIN/OTP/WebAuthn) do `nasaex-wey` ou simplifica para o padrão de permissões do nerp-2 — **provavelmente simplificar**.

---

## Decisoes tomadas

- **Espelhar o ledger do `nasaex-wey`**, mas **conciliar com `FinancialAccount`/`Transaction`** já existentes em vez de duplicar.
- Régua de cobrança e aprovações entram; a camada de acesso forte (PIN/OTP/WebAuthn) é opcional e provavelmente simplificada.

---

## Proximos passos

1. Decidir o modelo de dados (conciliar vs substituir).
2. Portar procedures + UI de contas.
3. Régua de cobrança (Inngest) + dashboard/fluxo de caixa.
4. Reconciliação com `pdv-caixa` e `pagamentos-gateway`.

---

## Melhorias futuras (nao urgentes)

- [ ] Aprovações/governança de despesas por limite.
- [ ] Exportações contábeis / integração com o financeiro externo.
