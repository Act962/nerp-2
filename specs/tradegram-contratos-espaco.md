# Gestão de Contratos por ID de Espaço — TradeGram

> Gerir contratos de ocupação comercial por `spaceCode` (Digital Space ID): indústria X ocupa o espaço Y, de tal data a tal data, por tal valor, com ciclo de vida próprio, e ao ativar gera lançamento(s) a receber no Financeiro.
> Feature: `src/features/trade-interest` + `src/app/router/space-negotiation` + `prisma/schema.prisma` (`MapObject`, `SpaceNegotiation`) + integração `router/financeiro`.
> Branch: `feat/tradegram-contratos-espaco` · Pilar: Indústria / Varejo (monetização de espaço)
> Criado em: 2026-08-18 · Status: 📋 Planejado

---

## Situacao atual

O "ID de espaço" já existe e é robusto: `MapObject.spaceCode` (`schema.prisma:2655+`) é o "CPF" do espaço (`WS-009-PG-002-PER`), único por org, gerado por `map-object/assign-space-code.ts`. `SpaceNegotiation` (`schema.prisma:2721`) já é uma **proto-tabela de contrato**: guarda `mapObjectId + supplierId/brandId + startDate/endDate + amount + status` (`RASCUNHO/PROPOSTA/FECHADA/CANCELADA`).

O "contrato ativo" **já é calculado**, mas derivado em runtime: `floor-plan/get-full.ts:29-43` = negociação `FECHADA` com `startDate <= now <= endDate`. `space-negotiation/list-expiring.ts` já entrega o pipeline de vencimento (usado no Painel do Trade). `SpaceInterest` + `FILA_ESPERA` já modela fila de espera por espaço ocupado.

**Não existe modelo `Contract`.** O gap é promover `SpaceNegotiation` a contrato de primeira classe — não criar tabela paralela que duplicaria tudo.

---

## Gaps a preencher

### Critico

- [ ] **Sem vigência exclusiva** — nada impede duas negociações `FECHADA` com janelas sobrepostas no mesmo `mapObjectId`. Falta constraint/validação de "um contrato vigente por espaço por vez".
- [ ] **Sem ciclo de vida de contrato** — `NegotiationStatus` não cobre `ATIVO/EXPIRADO/RENOVADO/RESCINDIDO/SUSPENSO`. `endDate` no passado não muda status automaticamente (só é calculado).

### Funcional

- [ ] **Sem faturamento/recorrência** — só existe `amount` único. Falta periodicidade (mensal/por período) e vínculo a lançamento financeiro.
- [ ] **Integração com Financeiro** (decisão do dev: **contrato gera lançamento**) — ao ativar um contrato, criar `PaymentEntry` RECEIVABLE (uma por parcela/competência) ligada ao contrato, categoria "Receita de Espaço/Trade", `competenceDate` = período do contrato.
- [ ] **Sem anexo/documento** — nenhum campo para PDF do contrato/assinatura/cláusulas.
- [ ] **`SpaceInterest` (fila) solto** — `FILA_ESPERA` não tem FK para o contrato que bloqueia o espaço; ao expirar/rescindir, poderia notificar a fila.

---

## Abordagem proposta

**Estender `SpaceNegotiation` (não criar tabela nova):**

1. Novo enum de status de contrato (ou coluna `contractStatus` separada do `NegotiationStatus`), com transição automática por vigência (job Inngest diário marca `EXPIRADO`).
2. Constraint de exclusividade temporal por `mapObjectId` (validação no `create`/`activate` + índice parcial).
3. Campos de recorrência (`billingCycle`, `installments`) + FK opcional para documento (R2 key).
4. `contractId` em `PaymentEntry` (nullable) → ao ativar, gera as parcelas a receber.
5. `blockingNegotiationId` em `SpaceInterest` → liga a fila ao contrato vigente.
6. Tela de gestão em `/trade/interesses` (ou nova `/trade/contratos`): lista por espaço, filtros por status/indústria/vencimento, ação ativar/renovar/rescindir.

## Criterios de aceite

- [ ] Cada espaço (`spaceCode`) mostra seu contrato vigente + histórico (imutável).
- [ ] Não é possível ativar dois contratos vigentes no mesmo espaço (bloqueio validado no servidor).
- [ ] Ativar um contrato cria os lançamentos a receber no Financeiro (uma por competência), visíveis em `/financeiro`.
- [ ] Contrato vencido vira `EXPIRADO` automaticamente (job) e libera o espaço (`spaceState` volta a `LIVRE`).
- [ ] Renovar cria novo registro preservando o histórico; rescindir encerra e (opcional) notifica a fila de espera.
- [ ] Multi-tenant: toda query com `organizationId`. Valores em centavos no boundary do Financeiro.

---

## Decisoes tomadas

- **Contrato + lançamento no Financeiro** (dev) — liga este spec ao `financeiro-dre-dro`: receita de espaço entra no DRE como receita não-operacional ou operacional (definir na classificação do DRO).
- **Promover `SpaceNegotiation`, não duplicar** — evita divergência entre "negociação" e "contrato".
- **Depende de** `auditoria-sincronizacao` (confirmar que não há outro consumidor de `SpaceNegotiation` que quebre com o novo status).
