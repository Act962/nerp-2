# Relatórios DRE e DRO no Financeiro

> Demonstração de Resultado do Exercício (DRE, por competência) e Demonstração de Resultado Operacional (DRO) no módulo Financeiro, agrupando lançamentos por categoria (Receita − Custo − Despesa = Resultado) e por centro de custo.
> Feature: `src/features/financeiro` + `src/app/router/financeiro` + `prisma/schema.prisma` (`PaymentEntry`, `PaymentCategory`, `PaymentCostCenter`).
> Branch: `feat/financeiro-dre-dro` · Pilar: Varejo (Órbita ERP)
> Criado em: 2026-08-18 · Status: 📋 Planejado

---

## Situacao atual

O Financeiro já tem a base necessária:
- **`PaymentCategory`** (`schema.prisma:4208`) tem `type` **`REVENUE/EXPENSE/COST`** (enum `FinancialCategoryType`, `:4179`) + hierarquia `parentId`. A tripla e a árvore do DRE já existem.
- **`PaymentEntry`** (`:4266`) tem `type` (RECEIVABLE/PAYABLE), `amount`/`paidAmount` (centavos), e **datas separadas**: `dueDate`, `paidAt` (caixa), **`competenceDate`** (competência, nullable).
- **`PaymentCostCenter`** (`:4229`) + `PaymentEntry.costCenterId` — dimensão para DRO.

O que **falta**: nenhum relatório DRE/DRO existe (grep vazio). O dashboard atual (`financeiro/dashboard.ts`) só separa RECEIVABLE × PAYABLE **por caixa (`paidAt`)** e **nunca lê `categoryId`/`type`/`costCenterId`**. Ou seja: não há agrupamento por categoria, nem regime de competência, nem classificação operacional.

---

## Gaps a preencher

### Critico

- [ ] **Novo procedure `reports.dre` / `reports.dro`** — não há rota de relatórios; criar arquivo em `router/financeiro/` e registrar em `index.ts:35`.
- [ ] **Agregação hierárquica por `type` + `parentId`** — montar a árvore Receita/Custo/Despesa somando entries por categoria, subtotalizando por pai (recursivo). Resultado = Receita − Custo − Despesa.
- [ ] **Regime de competência** — DRE agrupa por `competenceDate` (com fallback definido para `dueDate`/`paidAt` quando null, pois é nullable), diferente do dashboard (caixa). Definir a regra de fallback com o dev.

### Funcional

- [ ] **DRO (resultado operacional)** — separar operacional × não-operacional/financeiro. Hoje **não há flag** além de `REVENUE/EXPENSE/COST`. Opções: (a) usar `costCenterId`, (b) marcar categorias como operacionais (`isOperational` boolean em `PaymentCategory`), (c) subtree de categoria. Decidir na abertura.
- [ ] **Filtro por período de competência no `listEntries`** — hoje `from/to` usa só `dueDate` (`entries.ts:149`); relatórios precisam recortar por `competenceDate`.
- [ ] **UI** — nova aba `dre-tab.tsx` / `dro-tab.tsx` seguindo o padrão de `dashboard-tab.tsx` (KPIs + Recharts + `formatCents`); tabela expansível da árvore + comparativo entre períodos.

### Melhorias futuras

- [ ] `parentId` em `PaymentCostCenter` (`:4229`) se o DRO exigir árvore de centros de custo (hoje é plano).
- [ ] Exportar DRE/DRO em PDF/xlsx.

---

## Criterios de aceite

- [ ] DRE por período (mês/trimestre/ano) mostra a árvore Receita − Custo − Despesa = Resultado, com subtotais por categoria-pai, **por competência**.
- [ ] Lançamentos sem `competenceDate` entram pela regra de fallback acordada (documentada na tela).
- [ ] DRO separa resultado operacional do não-operacional pelo critério escolhido.
- [ ] Comparativo entre dois períodos (ex.: mês atual × anterior) com variação %.
- [ ] Valores em centavos no servidor, formatados com `formatCents` na UI. Multi-tenant: toda query com `organizationId`.
- [ ] Bate com o dashboard nos totais quando o filtro é equivalente (sanity check).

---

## Decisoes tomadas

- **Reaproveitar o que existe** — `REVENUE/EXPENSE/COST` + `parentId` + `competenceDate` já dão o DRE sem mudança de schema (exceto, talvez, a flag do DRO).
- **Liga com Contratos (spec 2)** — receita de espaço/Trade entra como lançamento; definir se é receita operacional ou não-operacional no DRO.
- **DRO por flag `isOperational` na categoria** (dev, 2026-08-18) — adiciona um booleano `isOperational` (default `true`) em `PaymentCategory`; o não-operacional (juros, multas, receitas financeiras) é marcado como `false`. Requer migration aditiva no Neon compartilhado (via apply manual + `migrate deploy` + bump `SCHEMA_VERSION`, nunca `migrate dev`).
- **Fallback de competência** (implementado no DRE): `competenceDate ?? dueDate`, excluindo `CANCELLED`.

## Status de entrega

- [x] **DRE** — procedure `financeiro.reports.dre` + aba DRE. Sem migration. ✅ 2026-08-18 (branch `feat/financeiro-dre-dro`, aguardando teste do dev).
- [ ] **DRO** — pendente da migration `isOperational` (aguardando go do dev pra rodar no Neon compartilhado).
