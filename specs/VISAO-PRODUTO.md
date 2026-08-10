# Orbita ERP — Visao do Produto

> Documento de referencia obrigatoria. Toda decisao tecnica, feature nova ou
> priorizacao deve estar alinhada com esta visao. Se uma solicitacao nao se
> encaixa em nenhum pilar ou modulo descrito aqui, pergunte antes de implementar.
>
> Atualizado em: 2026-08-07

---

## O que e o Orbita ERP

Plataforma de Inteligencia Comercial que conecta **Industria**, **Distribuidor**,
**Varejo** e **Consumidor** numa unica base de dados.

Nao somos apenas um ERP. Somos uma infraestrutura digital que transforma cada
loja em uma fonte continua de inteligencia comercial.

**O problema que resolvemos:** o varejo brasileiro tem bons ERPs para controlar
operacao (estoque, vendas, compras, financeiro), mas nenhum administra o espaco
comercial nem gera inteligencia de mercado. Cada ator trabalha isolado:

- A industria nao sabe onde seu produto esta.
- O distribuidor nao sabe como esta a execucao.
- O supermercado nao monetiza seus ativos comerciais.
- O consumidor compra sem acesso a informacoes inteligentes.

**O conceito central:** cada metro quadrado do supermercado possui inteligencia.
Uma ponta de gondola deixa de ser apenas uma ponta — ela passa a ter identidade
digital, historico, campanhas, fotos, planograma, contratos, disponibilidade,
fila de negociacao e indicadores de ROI.

---

## Os 4 Pilares

### 1. Industria

Acompanha em tempo real: onde seus produtos estao, espacos negociados, execucao
de campanhas, ruptura, share de gondola, ROI de Trade Marketing, comportamento
do consumidor, inteligencia por regiao.

| No codigo | Onde |
|-----------|------|
| Industria = `Supplier` | `src/features/supplier`, `router/supplier` |
| Marcas | `src/features/brands`, `router/brand` |
| Negociacao de espacos | `src/features/trade-interest`, `router/space-negotiation` |
| Catalogo PDV (midias/espacos) | `src/features/pdv-catalog`, `router/trade-catalog` |
| Books (relatorio fotografico) | `src/features/books`, `router/book` |
| Fotos do PDV | `src/features/pdv-photos`, `router/pdv-photo` |
| Insights para industria | `src/features/shopper-insights` (futuro) |

### 2. Distribuidor

Acompanha: metas, representantes, vendedores, cobertura, positivacao, Sell In,
Sell Out, execucao, promotores, indicadores comerciais.

| No codigo | Onde |
|-----------|------|
| Distribuidores | `src/features/distributor`, `router/distributor` |
| Promotores e vinculos | `src/features/promotor`, `router/promotor` |
| App Promotor (campo) | `src/app/(promotor)/promotor` |
| App Vendedor (campo) | `src/app/(promotor)/vendedor` |
| Rotas de promotor | `src/features/promoter-route`, `router/promoter-route` |
| Ranking / Metas | `src/features/ranking`, `router/ranking` |
| Mapa de campo | `src/features/mapa-de-campo`, `router/field-map` |

### 3. Supermercado (Varejo)

Utiliza o ERP completo (financeiro, compras, estoque, fiscal, BI, CRM) e
transforma seus espacos fisicos em ativos digitais negociaveis.

| No codigo | Onde |
|-----------|------|
| Dashboard / BI | `src/features/dashboard`, `router/dashboard` |
| Dashboard Org (Oracle) | `src/features/org-dashboard`, `router/org-dashboard` |
| Vendas / PDV | `src/features/sales`, `router/sales` |
| Produtos | `src/features/products`, `router/products` |
| Estoque | `src/features/stock`, `router/stock` |
| Clientes | `router/customer` |
| Fornecedores | `src/features/supplier`, `router/supplier` |
| Catalogo online (storefront) | `src/features/storefront`, `src/app/(storefront)` |
| Catalogo promocional | `src/features/promotional-catalog` |
| Colaboradores | `src/features/collaborators` |
| Pedidos / Cozinha | `src/features/pedidos`, `src/app/(waiter)` |
| Lojas + Mapa da loja | `src/features/stores`, `src/features/store-map` |
| Configuracoes / Membros | `src/features/configuracoes`, `router/org`, `router/members` |

### 4. Consumidor

Gerador de inteligencia. Ao escanear um QR Code na loja, inicia uma sessao.
Cada interacao (escanear produto) gera dados: loja, horario, categoria, marca,
produto, sequencia de interesse, tempo entre interacoes.

> **Nao rastreamos o consumidor. Reconstruimos sua jornada de interesse.**

| No codigo | Onde |
|-----------|------|
| QR Preco / Scanner | `src/features/shopper`, `router/shopper` |
| Sessao de scan (ScanEvent) | modelo `ScanEvent` + `ScanEventKind` |
| Shopper (consumidor) | modelo `Shopper` |
| Cupons / Cashback | `src/features/coupon`, `router/coupon` |
| Storefront (catalogo publico) | `src/app/(storefront)/[subdomain]` |

---

## Os Modulos

### Orbita ERP

Gestao completa da empresa: Financeiro, Estoque, Compras, Fiscal, CRM, BI.

**No codigo:** tudo sob `src/app/(main)/(rest)/` (varejo) — dashboard, vendas,
produtos, estoque, clientes, fornecedores, catalogo, colaboradores, ranking,
integracoes, configuracoes.

### TradeGram

Plataforma de execucao do Trade Marketing: auditorias, checklists, fotos,
pesquisas, campanhas, promotores, IA, planograma.

**No codigo:** `src/features/tradegram`, `router/tradegram-public`,
`src/app/(public)/tradegram` (6 paginas publicas), `/trade/tradegram` (admin).

### Orbita Map

O Google Maps do varejo. Mostra redes, lojas, layout, corredores, ilhas,
checkouts, espacos promocionais, pontos extras, disponibilidade, fila de
espera, historico de negociacoes.

**No codigo:** `src/features/store-map` (engine Konva), `src/features/stores`,
`router/floor-plan`, `router/map-object`, `router/map-layer`,
`router/map-annotation`, `src/app/(pdv)/mapa/[storeId]` (viewer de campo).

### Orbita Insights

Paineis para industria e distribuidores: Market Share, Sell In, Sell Out,
Ruptura, Share de Gondola, ROI, Cobertura, Benchmark, IA Preditiva.

**No codigo:** `src/features/shopper-insights`, `router/shopper-insights`,
`src/features/trade-dashboard`, `router/trade-dashboard`,
`src/features/org-dashboard`, `router/oracle-explorer`.

### Orbita Shelf

Gestao inteligente do planograma: comparacao automatica, fotos, execucao,
share de espaco, ocupacao, alertas.

**No codigo:** `src/features/planogram`, `router/planogram`,
`/trade/planograma` (+editar, revisoes, visao-geral).

### Orbita Connect

Integracao com ERPs existentes (WinThor, CISS, TOTVS, Oracle, SAP, APIs).
O cliente nao precisa trocar seu ERP — o Orbita conecta tudo.

**No codigo:** `src/features/erp-sync`, `router/erp-sync`, integracao NASA
(`NasaIntegrationConsent`, `SyncOutbox`, jobs Inngest `erp-sync-*`).

### Orbita Consumer Intelligence

Ao entrar na loja o consumidor escaneia um QR Code. Durante a compra pode
escanear qualquer produto. Cada interacao gera inteligencia. O sistema
registra: loja, horario, categoria, marca, produto, sequencia de interesse,
tempo entre interacoes.

Com milhares de consumidores, identificamos padroes:
- quem pesquisa cafe normalmente tambem pesquisa leite
- consumidores interessados em cerveja passam pelo setor de churrasco
- produto com muitas consultas e poucas compras = oportunidade de ajuste

**No codigo:** `src/features/shopper`, `router/shopper`, modelo `ScanEvent`,
`/trade/qr-preco`, `/trade/insights`.

---

## Estrategia comercial

Nao queremos substituir o ERP existente. Queremos nos conectar a ele. O ERP
controla a operacao; o Orbita transforma dados operacionais em inteligencia
comercial para todo o ecossistema.

### Modelo de receita

| Fonte | Publico | Detalhe |
|-------|---------|---------|
| SaaS (mensalidade) | Supermercados, distribuidores | Setup + mensalidade (a definir) |
| Inteligencia Comercial | Industrias, distribuidoras | Assinatura para dashboards e indicadores |
| Espaco Comercial | Industrias, distribuidoras | Negociacao de espacos no mapa (valor a negociar) |
| Produto de Recomendacao | Industrias, distribuidoras | Recomendacao dentro do QR/scanner (valor a negociar) |
| Implantacao | Todos | Treinamento, parametrizacao, integracoes |
| Marketplace | Todos | Aplicacoes e modulos adicionais |
| APIs | Parceiros | Integracoes premium |
| IA | Todos | Servicos avancados de inteligencia |

### Efeito de rede

O maior ativo nao e o software — e a base de inteligencia. Quanto maior a
rede de supermercados conectada, maior o valor da plataforma para todos:

- O supermercado melhora gestao e monetiza espacos.
- O distribuidor aumenta eficiencia comercial.
- A industria toma decisoes baseadas em dados reais.
- O consumidor recebe experiencia mais rica e personalizada.

---

## Regras para decisoes tecnicas

1. **Toda feature deve servir a pelo menos um pilar.** Se nao serve Industria,
   Distribuidor, Varejo ou Consumidor, questione se deveria existir.

2. **Inteligencia e o produto.** Priorize features que geram ou consomem dados
   (scans, fotos, negociacoes, execucao) sobre features puramente operacionais.

3. **Conectar > substituir.** Integracoes com ERPs existentes tem prioridade
   sobre reimplementar funcionalidades que eles ja fazem bem.

4. **Cada metro quadrado importa.** Features de mapa, planograma, negociacao
   de espacos e fotos de PDV sao o diferencial. Trate-as como core, nao como
   acessorio.

5. **O consumidor e gerador, nao custo.** O QR/scanner deve ser frictionless.
   Funcionalidades para o consumidor devem gerar inteligencia como efeito
   colateral, nunca como tarefa explicita.

6. **Multi-tenant e sagrado.** Toda query escopada por `organizationId`. Sem
   excecao. A base de inteligencia e cruzada, mas os dados operacionais sao
   isolados por tenant.
