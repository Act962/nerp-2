# Auditoria de Sincronização do NERP — o que deveria conversar entre os apps

> Diagnóstico dos fluxos de dados entre os 8 apps e os ERPs externos. Primeira passada (2026-08-18), baseada em leitura de código; itens marcados _(validar)_ pedem confirmação com o dev antes de virar tarefa.
> Spec: `specs/auditoria-sincronizacao.md` · Saída: esta análise + specs derivados.

---

## 1. Dois "syncs" distintos (não confundir)

| Pipeline | Direção | O quê | Onde |
|----------|---------|-------|------|
| **NERP → NASA** (auth outbox) | saída | Só identidade: user/account/org/member | `SyncOutbox` (`schema.prisma:1543`), Inngest `sync-nasa-delivery` (`src/lib/inngest/functions.ts:42`), `src/lib/sync-deliver.ts` |
| **Winthor (Oracle) → NERP** (espelho) | entrada, **read-only** | Vendedores + fatos de venda diários | `run-erp-sync.ts:30`, conector `connectors/winthor.ts`, jobs `erp-sync-*` (`functions.ts:343-399`) |

O ERP do cliente **nunca** recebe escrita (só SELECT). A NASA só recebe **auth** — **nenhum dado de negócio** (produto, preço, estoque) tem outbox NERP→NASA.

---

## 2. Matriz produtor → consumidor (modelos-chave)

| Modelo | Escreve (produtor) | Lê hoje (consumidor) | Deveria ler e **não lê** |
|--------|--------------------|----------------------|--------------------------|
| **`Sale`** (PDV, `schema.prisma:981`) | `checkout/*`, `sales/*` | `sales/*`, `dashboard/dashboard.ts`, `dashboard-widgets/_native-aggregation` + `_geo-aggregation`, `ranking/_sales-aggregation` | Trade/Insights (sell-out real por loja/produto) |
| **`SalesFactDaily`** (espelho Winthor) | `run-erp-sync.ts` | `ranking/_sales-aggregation` + `_virtual-period`, `dashboard-widgets/_erp-aggregation`, `erp-sync/status` | **Reconciliação com `Sale`** — no ranking os dois são **mutuamente exclusivos** (escolhe um pelo `kind` da conexão), nunca somados |
| **`ScanEvent`** (demanda shopper, `:2400`) | `tradegram-public/log-scan`, `identify-product` | **só** `shopper-insights/overview.ts` | `trade-dashboard`, `org-dashboard`, App Promotor (priorizar visita por demanda) |
| **`SpaceNegotiation`** (`:2721`) | `space-negotiation/create` | mapa (`use-space-negotiations`), `map-object/list-opportunities`, `trade-dashboard/overview` | Financeiro (receita de espaço — hoje inexiste) |
| **`PdvPhoto`** (`:2942`) | `pdv-photo/create` | Books, mapa (`link-map-object`), posição do promotor (`field-map/promoter-positions:18`) | ✅ bom acoplamento |
| **`ExternalSeller`** (Winthor) | `run-erp-sync.ts:57` (upsert) | ranking, widgets ERP | vínculo automático com `Member`/vendedor de campo |
| **Estoque externo** | — (não espelhado) | só consultável via **Oracle Explorer** (dicionário) | não há modelo de estoque sincronizado no NERP _(validar se é intencional)_ |

---

## 3. Gaps priorizados

### Crítico

1. **Dois universos de venda sem reconciliação** _(confirmado)_ — `Sale` (PDV/sell-out próprio) e `SalesFactDaily` (faturamento Winthor/sell-in) só aparecem juntos em `ranking/_sales-aggregation.ts`, mas `buildAchievedLookup` (`:226`) escolhe **um ou o outro** pelo `kind` da conexão — **nunca soma nem cruza**. Sem isso não há **sell-in × sell-out** unificado — o indicador central dos pilares Indústria e Distribuidor.
   - Impacto: Indústria, Distribuidor · Esforço: **G**

2. **`orphanSellerCodes` calculado e descartado** (`run-erp-sync.ts:88`) — o sync já sabe quais códigos vendem no Winthor sem `Member` vinculado, e joga fora. Vira alerta/flag de dessincronização com baixo esforço.
   - Impacto: Distribuidor (cobertura), operação · Esforço: **P**

### Funcional

3. **`ScanEvent` isolado** — a demanda do consumidor (scans, buscas, `UNKNOWN_BARCODE` = gaps de catálogo) só chega no Insights. Não realimenta Trade, dashboard nem a rota do promotor.
   - Impacto: Indústria, Consumidor · Esforço: **M**

4. **Dois cadastros de "vendedor" paralelos** — trade (`PromoterStore`/`PromoterSupplier`) vs. faturamento (`ExternalSeller`), vínculo a `Member` só manual (`run-erp-sync.ts:57`). O vendedor de campo e o que fatura não se ligam automaticamente.
   - Impacto: Distribuidor · Esforço: **M**

5. **Oracle Explorer não realimenta nada** — consultas custom contra o Winthor viram só widgets; não voltam para ranking, promotor ou insights.
   - Impacto: Varejo (BI) · Esforço: **M**

6. **Estoque externo não sincronizado** _(validar)_ — o estoque do ERP do cliente é só consultável ad-hoc via Oracle Explorer; não há espelho. Ruptura/share dependem disso.
   - Impacto: Indústria (ruptura) · Esforço: **G**

---

## 4. Specs derivados (cada um vira branch/PR próprio)

| Branch | Escopo (1 linha) | Prioridade |
|--------|------------------|------------|
| `feat/sync-gap-alerts` | Persistir + alertar `orphanSellerCodes` e outros sinais de dessincronização | 🔥 rápido, alto valor |
| `feat/reconciliacao-vendas` | Unificar `Sale` + `SalesFactDaily` em uma visão sell-in × sell-out | Alta |
| `feat/scan-para-trade` | `ScanEvent` alimentando trade-dashboard + rota do promotor | Média |
| `feat/vendedor-unificado` | Ligar automaticamente `ExternalSeller` ↔ vendedor de campo/`Member` | Média |
| `feat/estoque-espelho` _(se validado)_ | Espelhar estoque do Winthor para cálculo de ruptura | Média/Alta |

---

## 5. Método e limitações

- Baseado em leitura estática do código (routers, features, `schema.prisma`, jobs Inngest). Não foi executado em dados reais.
- Itens _(validar)_ — reconciliação em `ranking`, intenção sobre estoque — precisam de confirmação do dev antes de virar tarefa.
- Esta auditoria **não altera código**. As correções são os specs derivados da seção 4, cada um na sua branch.
