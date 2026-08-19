# Auditoria de Sincronização — o que deveria conversar entre os apps e não conversa

> Levantamento diagnóstico dos fluxos de dados entre ERP Admin, TradeGram, App Promotor, App Vendedor, PDV, Shopper e ERPs externos. Saída = mapa de gaps + specs derivados. Não é feature de código: é a análise que calibra os specs 2, 4 e 5.
> Escopo transversal: `router/erp-sync`, `SyncOutbox`, `SalesFactDaily`, `Sale`, `ScanEvent`, `SpaceNegotiation`, `PdvPhoto`.
> Branch: `docs/auditoria-sincronizacao` · Pilar: Órbita Connect (transversal)
> Criado em: 2026-08-18 · Status: 📋 Planejado

---

## Situacao atual

A arquitetura do Órbita é para "conversar entre si", mas hoje existem **dois universos de venda que nunca se cruzam** e **sinais de demanda/execução que morrem na ponta**. Há dois "syncs" distintos que precisam ser separados na cabeça antes de auditar:

- **NERP → NASA** (auth outbox): `SyncOutbox` (`schema.prisma:1543`) grava user/account/org/member; entrega via Inngest `sync-nasa-delivery` (`src/lib/inngest/functions.ts:42`). Só identidade — **nenhum dado de negócio** (produto, preço, estoque) tem outbox.
- **Winthor (Oracle) → NERP** (espelho de vendas, read-only): `run-erp-sync.ts:30` espelha `ExternalSeller` + `SalesFactDaily`. O ERP do cliente nunca recebe nada além de SELECT.

O que **já conecta bem**: foto do App Promotor → Books + Mapa (`pdv-photo/link-map-object.ts`, `field-map/promoter-positions.ts:18`); negociação de espaço → Trade Dashboard; PDV (`Sale`) → widgets nativos do Dashboard.

---

## Gaps de sincronização identificados (a validar/priorizar)

### Critico

- [ ] **Dois universos de venda sem reconciliação** — `Sale` (PDV, `schema.prisma:981`) alimenta os widgets nativos; `SalesFactDaily` (espelho Winthor) alimenta ranking e widgets ERP. Não há join nem reconciliação → **sem sell-in × sell-out unificado**, que é o coração do pilar Indústria/Distribuidor. Gap #1.
- [ ] **`orphanSellerCodes` descartado** (`run-erp-sync.ts:88`) — o sync já detecta códigos que vendem no Winthor mas não têm `Member`/cadastro vinculado, e **joga fora**. É um sinal de dessincronização pronto para virar alerta/flag. Menor esforço, alto valor.

### Funcional

- [ ] **`ScanEvent` isolado** (`schema.prisma:2400`) — a demanda do shopper (scans, buscas, `UNKNOWN_BARCODE` = gaps de catálogo) só chega em `shopper-insights/overview.ts`. Não realimenta `trade-dashboard`, `org-dashboard`, nem o App Promotor (que poderia priorizar visitas por demanda real). Gap #2.
- [ ] **Dois cadastros de "vendedor" paralelos** — trade (`PromoterStore`/`PromoterSupplier`) vs. faturamento (`ExternalSeller` do Winthor, vínculo a `Member` só manual em `run-erp-sync.ts:57`). Não há ligação automática entre o vendedor de campo e o vendedor que fatura.
- [ ] **Oracle Explorer não realimenta nada** — consultas custom contra o Winthor viram só widgets de dashboard; não voltam para ranking, promotor ou insights.

---

## Entregável desta branch

1. **Relatório de gaps** (`docs/AUDITORIA-SINCRONIZACAO.md`): tabela produtor → consumidor esperado → status (conectado / isolado / manual), com impacto por pilar.
2. **Matriz de fluxo**: para cada modelo-chave (`Sale`, `SalesFactDaily`, `ScanEvent`, `SpaceNegotiation`, `PdvPhoto`, `ExternalSeller`), quem escreve e quem deveria ler.
3. **Specs derivados priorizados** — cada gap "para corrigir" vira seu próprio spec/branch (ex.: `feat/reconciliacao-vendas`, `feat/scan-para-trade`, `feat/vendedor-unificado`, `feat/sync-gap-alerts`).

## Criterios de aceite

- [ ] Relatório cobre os 8 apps e os modelos-chave, cada fluxo classificado (conectado / isolado / manual).
- [ ] Cada gap tem: produtor, consumidor faltante, impacto no pilar, esforço estimado (P/M/G).
- [ ] Saída termina com uma lista priorizada de specs derivados (nome de branch + 1 linha de escopo).
- [ ] Nenhuma mudança de código nesta branch — é diagnóstico. As correções vão nos specs derivados.

---

## Decisoes tomadas

- **É a primeira das 5** — alimenta o escopo dos specs Contratos (2), ASTRO (4) e DRE/DRO (5), porque mostra onde os dados já existem e onde falta gancho.
- **NASA ≠ ERP do cliente** — tratar os dois pipelines separadamente no relatório para não confundir auth-sync com espelho de vendas.
