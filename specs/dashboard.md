# Dashboard — Spec Completo

> Painel de inteligencia do Orbita ERP. Dashboard pessoal (por membro),
> organizacional (compartilhado, admin-managed) e publico (via link).
> Feature: `src/features/dashboard` + `src/features/dashboard-widgets` + `src/features/org-dashboard`
> Router: `src/app/router/dashboard` + `src/app/router/dashboard-widgets` + `src/app/router/org-dashboard` + `src/app/router/oracle-explorer`
> Paginas: `/dashboard`, `/dashboard-organizacao`, `/publico/dashboard/[shareToken]`
> Criado em: 2026-08-07 · Atualizado em: 2026-08-07
> Status: 🟢 Funcional (sistema de widgets maduro, com pontos de melhoria)

---

## Situacao atual

O dashboard e o modulo mais complexo do NERP. Possui **3 camadas**:

1. **Dashboard Pessoal** (`/dashboard`, aba "Meu dashboard") — cada membro monta
   seu proprio painel com widgets arrastáveis (react-grid-layout). 18 widgets
   nativos + Oracle custom + metricas manuais. Fullscreen, alertas, som, notificacoes OS.

2. **Dashboard Organizacional** (`/dashboard`, aba "Da organizacao" + `/dashboard-organizacao`)
   — admin monta paineis compartilhados com permissoes por membro x widget.
   9 templates de painel pre-configurados. Compartilhavel via link publico.

3. **Dashboard Publico** (`/publico/dashboard/[shareToken]`) — visualizacao sem auth
   controlada por token + whitelist de widgets visiveis.

Existe ainda um **router legado** (`router/dashboard/dashboard.ts`) com endpoint
monolitico que retorna totais fixos. Ele foi substituido pelo sistema de widgets
mas nunca foi removido.

### Pilares do Orbita atendidos

- **Varejo**: vendas, estoque baixo, ticket medio, movimentacoes — dados nativos
- **Distribuidor**: ranking de vendedores, metas, cobertura — widgets de ranking
- **Industria**: dados de ERP externo via Oracle custom, Sell In/Out — widgets ERP
- **Consumidor**: (indireto) dados de scan/shopper poderiam alimentar widgets futuros

---

## Arquitetura

### Tipos de widget (`WidgetValue.kind`)

| Kind | Renderizador | Descricao |
|------|-------------|-----------|
| `STAT` | `stat-widget.tsx` | Numero unico + icone + progress ring + sparkline + delta |
| `CHART` | `chart-widget.tsx` | LINE, BAR ou DONUT (Recharts) |
| `LIST` | `list-widget.tsx` | Lista com rank, label, meta e valor |
| `MAP` | `map-widget.tsx` | Choropleth SVG (Brasil estados ou Piaui municipios) |
| `TABLE` | `table-widget.tsx` | Tabela scrollavel com header sticky |
| `FLEET` | `fleet-widget.tsx` | Rastreamento de frota (placa, motorista, carga, ETA) |
| `FEED` | `feed-widget.tsx` | Feed de alertas (icone, titulo, subtitulo, hora) |
| `RANKING` | `ranking-widget.tsx` | Embute a RankingPage completa |

### Registry de fontes de dados (18 + Oracle + manuais)

| Categoria | Widgets | Fonte |
|-----------|---------|-------|
| **native** (9) | salesTotal, salesToday, avgTicket, productsActive, lowStockCount, lowStockList, latestSales, stockMovementsTrend, salesTodayByHour | Prisma direto (aggregate/findMany) |
| **ranking** (3) | teamRankingTop, topTeamPercent, orgGoalVsAchieved | `buildSalesGoalRanking` (modulo ranking) |
| **erp** (5) | revenueTrend, margin, ordersCount, revenueBySeller, revenueBySellerChart | `SalesFactDaily` (tabela espelho do ERP) |
| **geo** (2) | salesByState, salesByPiauiMunicipio | Sales + Customer location |
| **oracle.custom** | Configuravel por admin | `OracleWidgetSnapshot` (stale-while-revalidate, 5min) |
| **manual.\<id\>** | Criado por admin | `DashboardManualMetric` (valor manual) |
| **content.fleet** | Dados estaticos em options | JSON no widget |
| **content.feed** | Dados estaticos em options | JSON no widget |

### Polling e refresh

- Dashboard pessoal: poll a cada **5 min** (ou **5s** se algum widget Oracle esta "Calculando...")
- Dashboard org: mesmo comportamento
- Oracle snapshots: cache de **5 min**, stale-while-revalidate, refresh manual rate-limited a **30s**
- Alertas server-side: cron Inngest **a cada 5 min**, 6h-22h, Seg-Sab (America/Fortaleza)

### Modelos Prisma

| Modelo | Tabela | Descricao |
|--------|--------|-----------|
| `DashboardWidget` | `dashboard_widgets` | Widget pessoal (memberId, dataSourceKey, layout, options, parentId) |
| `DashboardManualMetric` | `dashboard_manual_metrics` | Metrica manual (organizationId, label, value, unit) |
| `OrgDashboard` | `org_dashboards` | Dashboard compartilhado (1 por org, shareToken, publicVisibleWidgetIds) |
| `OrgDashboardPanel` | `org_dashboard_panels` | Painel/secao do dashboard org (category, title, color, appearance) |
| `OrgDashboardWidget` | `org_dashboard_widgets` | Widget no dashboard org (panelId, layout, options) |
| `OrgDashboardMemberPermission` | `org_dashboard_member_permissions` | Permissao membro x widget |
| `OracleWidgetSnapshot` | — | Cache de resultado Oracle (fingerprint, computedAt, durationMs, error) |
| `SalesFactDaily` | — | Espelho diario de vendas do ERP externo |
| `DashboardWidgetDisplayType` | enum | STAT, CHART, LIST, MAP, TABLE |
| `DashboardWidgetChartKind` | enum | LINE, BAR, DONUT |

### Fluxo de dados

```
/dashboard (page.tsx)
  └─ DashboardPage (client)
      ├─ Aba "Meu dashboard"
      │   └─ DashboardGrid
      │       ├─ useMyDashboardWidgets() → listMine (metadata)
      │       ├─ useDashboardWidgetValues() → resolveValues (poll 5min)
      │       └─ WidgetFrame → StatWidget / ChartWidget / MapWidget / ...
      │
      └─ Aba "Da organizacao"
          └─ OrgDashboardTab
              ├─ useOrgDashboard() → orgDashboard.get
              ├─ useOrgDashboardValues() → orgDashboard.resolveValues (poll 5min)
              └─ OrgDashboardView (read-only)

/dashboard-organizacao (page.tsx, permissao "dashboard-org")
  └─ OrgDashboardEditor (admin)
      ├─ Aba Widgets: add/edit/remove widgets em paineis
      ├─ Aba Permissoes: matriz membro x widget
      └─ Aba Compartilhar: link publico + whitelist

/publico/dashboard/[shareToken] (sem auth)
  └─ PublicOrgDashboard
      └─ OrgDashboardView (read-only, filtrado por publicVisibleWidgetIds)

Background (Inngest cron */5 6-22 Seg-Sab)
  └─ checkWidgetAlerts() → resolve valores → compara threshold → marca lastFiredAt
      └─ Client poll capta mudanca → toast + som + notificacao OS
```

---

## Arquivos principais

**Paginas:**
- `src/app/(main)/(rest)/dashboard/page.tsx` — entry, requirePermission("dashboard")
- `src/app/(main)/(rest)/dashboard-organizacao/page.tsx` — requirePermission("dashboard-org")
- `src/app/(public)/publico/dashboard/[shareToken]/page.tsx` — sem auth

**Feature dashboard (container):**
- `src/features/dashboard/components/dashboard.tsx` — DashboardPage (tabs, fullscreen, shortcuts)
- `src/features/dashboard/components/dashboard-shortcuts.tsx` — atalhos configuraveis

**Feature dashboard-widgets (core):**
- `src/features/dashboard-widgets/components/dashboard-grid.tsx` — grid react-grid-layout
- `src/features/dashboard-widgets/components/widget-frame.tsx` — card wrapper
- `src/features/dashboard-widgets/components/widget-picker-sheet.tsx` — adicionar widget
- `src/features/dashboard-widgets/components/widget-edit-sheet.tsx` — editar widget
- `src/features/dashboard-widgets/components/widget-customize-fields.tsx` — form completo (~1163 linhas)
- `src/features/dashboard-widgets/components/widget-detail-dialog.tsx` — drilldown em tabela
- `src/features/dashboard-widgets/components/widgets/` — 8 renderizadores (stat, chart, map, table, list, fleet, feed, ranking)
- `src/features/dashboard-widgets/hooks/use-dashboard-widgets.ts` — 8 hooks (CRUD + values + layout)
- `src/features/dashboard-widgets/lib/` — widget-alert, widget-appearance, widget-value, pastel-colors, grid-breakpoints, alert-sound, oracle-query-config
- `src/features/dashboard-widgets/server/check-widget-alerts.ts` — cron de alertas

**Feature org-dashboard:**
- `src/features/org-dashboard/components/org-dashboard-editor.tsx` — editor admin (3 abas)
- `src/features/org-dashboard/components/org-dashboard-view.tsx` — view read-only
- `src/features/org-dashboard/components/org-dashboard-permissions-matrix.tsx` — matriz permissoes
- `src/features/org-dashboard/components/org-dashboard-share-panel.tsx` — link publico
- `src/features/org-dashboard/lib/panel-templates.ts` — 9 templates em 8 categorias

**Router dashboard-widgets (14 procedures):**
- `_registry.ts` — WIDGET_REGISTRY (18 definicoes)
- `_types.ts` — WidgetValue union type (server-only)
- `_native-aggregation.ts` — 9 resolvers nativos
- `_erp-aggregation.ts` — 5 resolvers ERP (SalesFactDaily)
- `_geo-aggregation.ts` — 2 resolvers geo (choropleth)
- `_ranking-widgets.ts` — 3 resolvers ranking
- `_oracle-custom.ts` — engine de snapshot Oracle (stale-while-revalidate)
- `resolve-values.ts`, `add-widget.ts`, `update-widget.ts`, `remove-widget.ts`, `save-layout.ts`, `list-my-widgets.ts`, `drilldown.ts`, `refresh-oracle-widget.ts`, `create/update/delete/list-manual-metric(s).ts`

**Router org-dashboard (18 procedures em 1 arquivo):**
- `src/app/router/org-dashboard/index.ts` (~997 linhas)

**Router legado:**
- `src/app/router/dashboard/dashboard.ts` — endpoint monolitico (LEGADO, nao usado)

---

## Pendencias

### Critico

_(Nenhum bug critico de seguranca identificado. Multi-tenancy esta correto — todos
os procedures passam por requireOrgMiddleware e filtram por organizationId.)_

### Funcional

- [ ] **Performance em geo-aggregation** (`_geo-aggregation.ts`) — carrega TODAS as
      vendas com localizacao do cliente via `findMany` sem `take` para agregar por
      estado/municipio. Em orgs com grande volume de vendas, pode estourar memoria.
      Solucao: agregar via `groupBy` no Prisma ou query raw com GROUP BY.

- [ ] **Race condition em ensureOrgDashboard** (`org-dashboard/index.ts`) — duas
      requisicoes admin simultaneas podem tentar criar o OrgDashboard ao mesmo tempo.
      O `@unique` em `organizationId` causa erro nao tratado. Solucao: `upsert` ou
      catch do erro de unique constraint.

- [ ] **Rate limit Oracle em memoria** (`refresh-oracle-widget.ts`) — usa `Map` no
      processo. Em deploy multi-instancia (serverless/Kubernetes), cada instancia tem
      seu proprio Map e o rate limit de 30s nao e compartilhado. Solucao aceitavel
      para deploy single-instance (Vercel single-region), mas registrar como limitacao.

- [ ] **Permissions matrix save sem await** (`org-dashboard-permissions-matrix.tsx:149`)
      — `saveAll` dispara `setPermissions.mutate()` em loop `for` sem `await`. Se uma
      chamada falha, as outras continuam e o usuario nao ve falha parcial. Solucao:
      `Promise.allSettled` ou batch endpoint.

### UX

- [ ] **WidgetValue type duplicado** (`_types.ts` server + `widget-value.ts` client`)
      — tipos mantidos manualmente em sync. Se um novo `kind` e adicionado no server
      mas nao no client, o dispatch cai silenciosamente no fallback `LIST`. Nao e bug
      hoje, mas e risco em evolucoes futuras.

- [ ] **widget-customize-fields.tsx tem ~1163 linhas** — formulario monolitico com
      oracle query builder, appearance, alertas, tudo junto. Candidato a split em
      sub-componentes (OracleQuerySection, AppearanceSection, AlertSection).

### Qualidade de codigo

- [ ] **Codigo legado nao removido** — 3 arquivos nao usados pelo sistema de widgets:
  - `src/features/dashboard/components/format-values.tsx` — helpers de formatacao antigos
  - `src/features/dashboard/hooks/use-dashboard.ts` — hook que chama `orpc.dashboard.list`
    mas ignora os props de data que recebe
  - `src/app/router/dashboard/dashboard.ts` — endpoint monolitico com 2 bugs confirmados:
    (1) `findMany` + `Array.reduce` em vez de `aggregate` para somar vendas,
    (2) `lowStockFromYesterdayToToday` subtrai na ordem errada

- [ ] **Router org-dashboard em arquivo unico** (`index.ts`, ~997 linhas) — 18 procedures
      num so arquivo. Deveria seguir o padrao do projeto: 1 procedure por arquivo,
      reexportados no index.

---

## Decisoes tomadas

- **Widgets sao pessoais por padrao** — cada membro monta seu painel. O dashboard
  organizacional e uma camada separada com permissoes explicitas.
- **Oracle nunca conecta em tempo de render** — sempre lê do snapshot. Refresh e
  assíncrono (stale-while-revalidate). Isso protege o dashboard de queries lentas
  ou conexoes instáveis com ERPs externos.
- **Alertas avaliados server-side** — cron Inngest a cada 5min. O client so exibe
  o alerta ja avaliado. Isso garante que alertas funcionam mesmo com o browser fechado
  (lastFiredAt fica no DB).
- **Seeding automatico** — na primeira visita, 4 widgets default sao criados
  (salesTotal, salesToday, productsActive, lowStockCount).
- **Layout por breakpoint** — cada widget tem layout (x,y,w,h) para lg/md/sm/xxs.
  Persistido com debounce de 400ms.

---

## Proximos passos

1. Remover codigo legado (3 arquivos dead code) — risco zero, ganho em clareza
2. Fix geo-aggregation (trocar findMany por groupBy) — performance
3. Fix ensureOrgDashboard race condition (upsert) — corretude
4. Split widget-customize-fields.tsx em sub-componentes — manutenibilidade
5. Split org-dashboard/index.ts em 1 arquivo por procedure — padrao do projeto

---

## Melhorias futuras (nao urgentes)

- [ ] Novos widgets para **pilar Consumidor**: scans por hora, categorias mais
      consultadas, jornada media — alimentados por `ScanEvent`
- [ ] Widget de **ruptura** (produto em falta na gondola) — pilar Industria
- [ ] Widget de **cobertura de promotor** (% lojas visitadas) — pilar Distribuidor
- [ ] Export do dashboard como **PDF/imagem** para relatorios
- [ ] **Dark mode** nos graficos Recharts (hoje herdam do tema mas sem ajuste fino)
- [ ] Dashboard **mobile-first** dedicado (hoje responsive mas otimizado para desktop)
- [ ] **Notificacoes push** reais (via service worker) em vez de Web Notification API
      que so funciona com browser aberto
- [ ] **Compartilhamento de widgets** entre membros (hoje so via dashboard org)
