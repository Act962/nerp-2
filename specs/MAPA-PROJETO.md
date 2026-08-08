# Mapa do Projeto NERP

> Referencia rapida que conecta cada area do sistema a seus arquivos, features, rotas e documentacao.
> Para a visao de produto, pilares e modulos: ver [`VISAO-PRODUTO.md`](./VISAO-PRODUTO.md)
> Atualizado em: 2026-08-07

---

## Apps (route groups)

O NERP tem **8 apps** independentes (cada route group e um "app" com layout proprio):

| App | Route group | Paginas | Descricao |
|-----|-------------|---------|-----------|
| **ERP Admin** | `(main)/(rest)/` | 17 areas + `/trade/*` (15 sub) | Painel administrativo do ERP. Sidebar, auth obrigatorio |
| **App Promotor** | `(promotor)/promotor` | `/promotor`, `/promotor/rota/mapa` | App mobile-first para promotor em campo: capturar fotos, rota, minhas fotos |
| **App Vendedor** | `(promotor)/vendedor` | `/vendedor` | Mesmo motor do Promotor (`PromotorApp mode='vendedor'`) + aba "Estou aqui" |
| **App PDV (Mapa)** | `(pdv)/mapa/[storeId]` | 1 pagina | Visualizacao do mapa da loja para campo (viewer, nao editor) |
| **Storefront** | `(storefront)/[subdomain]` | 9 paginas | Loja online publica por tenant: catalogo, carrinho, checkout, conta |
| **App Garcom** | `(waiter)` | `/registrar-pedido/[orgSlug]`, `/pedido-cliente/[orderId]` | Registro de pedidos (restaurante/food) |
| **Painel Pedidos** | `(pedidos-display)/painel` | `/painel/[orgSlug]` | Display de cozinha/producao (tela TV) |
| **Paginas Publicas** | `(public)` | TradeGram (6 pags), catalogo-pdv share, ranking publico, dashboard share | Paginas sem auth, compartilhaveis |

Auxiliares: `(auth)` = login/cadastro, `(home)` = landing, `(org)` = criar organizacao.

---

## Features do ERP Admin

### Varejo

| Feature | Pagina | Feature dir | Router | Spec/Doc |
|---------|--------|-------------|--------|----------|
| **Dashboard** | `/dashboard` | `dashboard` | `dashboard`, `dashboard-widgets` | — |
| **Dashboard Org** | `/dashboard-organizacao` | `org-dashboard` | `org-dashboard`, `oracle-explorer` | — |
| **Vendas** | `/vendas` (+`/novo`) | `sales` | `sales` | — |
| **Pedidos** | `/pedidos` | `pedidos` | `pedidos` | — |
| **Produtos** | `/produtos` (+`/novo`,`/[id]`,`/editar`,`/categorias`,`/importar`) | `products` | `products`, `category` | — |
| **Estoque** | `/estoque` (+`/movimentacoes`) | `stock`, `store-inventory` | `stock`, `store-inventory` | — |
| **Clientes** | `/clientes` (+`/importar`) | `custom` (vestigial, ver `customer` router) | `customer` | — |
| **Fornecedores** | `/fornecedores` (+`/importar`) | `supplier` | `supplier` | `specs/fornecedores.md`, `specs/importacao-fornecedores.md` |
| **Catalogo Online** | `/catalogo` | `catalogo` | `catalog` | — |
| **Catalogo Promocional** | `/catalogo-promocional` (+`/[catalogId]`) | `promotional-catalog` | `promotional-catalog` | `docs/catalogo-promocional/00-06` |
| **Colaboradores** | `/colaboradores` | `collaborators` | `collaborators` | — |
| **Ranking** | `/ranking` | `ranking` | `ranking` | — |
| **Integracoes** | `/integracoes` | `erp-sync` | `erp-sync` | — |
| **Configuracoes** | `/configuracoes` | `configuracoes` | `org`, `members`, `invitation`, `billing` | — |
| **Lojas** | `/lojas` (+`/[storeId]`,`/[storeId]/mapa`,`/[storeId]/reposicao`,`/importar`) | `stores`, `store-map` | `store`, `floor-plan`, `map-object`, `map-layer`, `map-annotation` | `docs/TRADE_MARKETING.md` |
| **Books** | `/books` (+`/[bookId]`) | `books` | `book` | `docs/TRADE_MARKETING.md` (sec 1,3) |

### Trade Marketing (`/trade/...`)

| Feature | Pagina | Feature dir | Router | Spec/Doc |
|---------|--------|-------------|--------|----------|
| **Painel Trade** | `/trade/painel` | `trade-dashboard` | `trade-dashboard` | — |
| **Calendario** | `/trade/calendario` | `calendario` | `calendar` | — |
| **Mapa de Campo** | `/trade/mapa-de-campo` | `mapa-de-campo` | `field-map` | — |
| **Cadastros** | `/trade/cadastros` | (agrega lojas/fornecedores/marcas) | — | — |
| **Catalogo PDV** | `/trade/catalogo-pdv` (+`/[catalogId]`) | `pdv-catalog`, `trade-catalog` | `trade-catalog` | — |
| **Cupons** | `/trade/cupons` | `coupon` | `coupon` | — |
| **Diretorio** | `/trade/diretorio` | `directory` | `directory` | — |
| **Distribuidores** | `/trade/distribuidores` | `distributor` | `distributor` | — |
| **Insights** | `/trade/insights` | `shopper-insights` | `shopper-insights`, `shopper` | — |
| **Interesses** | `/trade/interesses` | `trade-interest` | `trade-interest`, `space-negotiation` | — |
| **Plano** | `/trade/plano` | `billing` (trade plan) | `billing` | — |
| **Planograma** | `/trade/planograma` (+`/[planogramId]`,`editar`,`revisoes`,`visao-geral`) | `planogram` | `planogram` | — |
| **Promotor Vinculos** | `/trade/promotor-vinculos` | `promotor` | `promotor` | — |
| **QR Preco** | `/trade/qr-preco` | `shopper` | `shopper` | — |
| **TradeGram** | `/trade/tradegram` | `tradegram` | `tradegram-public` | — |

### Fotos PDV (transversal)

| Feature | Usada em | Feature dir | Router |
|---------|----------|-------------|--------|
| **Fotos PDV** | Lojas > mapa, App Promotor, App Vendedor, Books | `pdv-photos` | `pdv-photo`, `media-model-photo` |

---

## Docs existentes e o que cobrem

| Arquivo | Cobre | Status |
|---------|-------|--------|
| `NERP-OVERVIEW.md` | Visao geral: stack, arquitetura, modelos, rotas, env vars, convencoes | Atualizado (2026-08-05) |
| `CLAUDE.md` | Instrucoes para o Claude Code (subconjunto do overview) | Atualizado |
| `docs/TRADE_MARKETING.md` | Modulo mapa/PDV/Book: modelo, engine Konva, roadmap M1-M9 | Parcialmente desatualizado (§11 fix IDOR ja feito) |
| `docs/PLANO_VISUALIZACAO_MAPA_TRADE.md` | Spec da "Area de Visualizacao" (viewer de campo, nao editor) | Spec aprovado |
| `docs/PROMOTOR_RASTREABILIDADE.md` | Rastreabilidade automatica: lastVisitAt, lastEditedBy, supervisor | Spec aprovado |
| `docs/catalogo-promocional/00-06` | Spec completo do catalogo promocional (6 etapas) | Paths parcialmente desatualizados |
| `specs/fornecedores.md` | CRUD fornecedores: IDOR fix, busca, paginacao, pendencias UX | Parcial (itens abertos) |
| `specs/importacao-fornecedores.md` | Importacao fornecedores via planilha | Entregue |

---

## Features sem documentacao (candidatas a spec)

Estas features existem no codigo mas nao tem nenhum doc/spec:

- Dashboard / Dashboard Org / Oracle Explorer
- Vendas / PDV
- Pedidos / Painel Cozinha
- Produtos (CRUD + importacao)
- Estoque / Inventario
- Clientes (CRUD + importacao)
- Catalogo Online (storefront settings)
- Colaboradores
- Ranking / Metas
- Integracoes (NASA, ERP sync)
- Configuracoes (org, membros, billing)
- Calendario Trade
- Mapa de Campo
- Cupons
- Diretorio de Empresas
- Distribuidores
- Shopper Insights / QR Preco
- Interesses / Negociacao de Espacos
- Planograma
- Promotor Vinculos
- TradeGram
- App Garcom
- App Promotor / App Vendedor

> **Roadmap ERP (núcleo de varejo)** já tem specs próprias — ver `README.md` › "ERP — Núcleo de varejo (roadmap)": `pdv-caixa`, `pagamentos-gateway`, `financeiro-contas`, `fiscal-tributacao`, `fiscal-emissao`, `impressao-cupom`, `pdv-atalhos-ui`, `pdv-offline`. Elas cobrem "Vendas / PDV" e as capacidades ausentes (caixa, fiscal, financeiro, impressão, atalhos, offline).

---

## Glossario rapido (termos do dominio)

| Termo | Significado no NERP |
|-------|---------------------|
| **Organizacao** | Tenant (empresa). Tudo e escopado por `organizationId` |
| **Membro** | Usuario dentro de uma org (`Member`). Tem `role` (owner/admin/member) e `tradeRole` |
| **Loja / Store** | PDV fisico. Tem endereco, gerente, mapa (FloorPlan) |
| **Industria** | = `Supplier` no contexto Trade. Quem negocia espaco na loja |
| **Marca / Brand** | Marca de uma industria. Tem logo proprio |
| **Book** | Relatorio fotografico PDF (fotos do PDV agrupadas, para enviar a industria) |
| **Mapa da Loja** | Planta baixa 2D (Konva). `FloorPlan` + `MapLayer` + `MapObject` |
| **PDV** | Ponto de venda = posicao no mapa (gondola, ilha, etc.) |
| **Promotor** | Pessoa em campo que visita lojas, tira fotos, atualiza informacoes |
| **Vendedor** | Variante do promotor com aba "Estou aqui" (geolocalizacao) |
| **Planograma** | Layout visual de como produtos devem ser dispostos na gondola |
| **TradeGram** | Rede publica de empresas/lojas para Trade Marketing |
| **Shopper** | Consumidor final que escaneia QR e ve precos |
| **Catalogo PDV** | Catalogo de midias/espacos da loja (para vender a industrias) |
| **Catalogo Promocional** | Folheto digital de produtos em promocao (exporta PNG/PDF) |
| **NASA** | ERP externo integrado via sync S2S |
| **Storefront** | Loja online publica acessada por subdominio do tenant |
