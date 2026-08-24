# Adicionar produto ao catálogo: filtros inteligentes (Oracle)

> No diálogo "Adicionar produto" do Catálogo Promocional, além de buscar por
> nome/SKU/EAN e por **categoria**, oferecer buscas "inteligentes" alimentadas
> pela integração **Oracle**: produtos mais vendidos, próximos do vencimento,
> de maior giro e de menor giro.
>
> Feature: `src/features/promotional-catalog` (UI) + `src/app/router/*` (dados)
> Branch alvo: `feat/catalogo-filtros-oracle` (nova)
> Criado em: 2026-08-21
> Status: 📋 Planejado (parte de categoria já entregue — ver abaixo)

---

## Entregue (nesta sessão, sem Oracle)

- **Filtro por categoria** no diálogo "Adicionar produto" (`add-product-dialog.tsx`):
  `Select` com as categorias da org (`orpc.categories.listAll`), filtrando a busca
  por `category: [slug]` em `orpc.products.list`.
- **Toggle "Adicionar todos os produtos desta categoria?"**: liga/desliga a
  categoria no `config.categoryFilter` do catálogo — o `list-promotional-products`
  já expande isso para TODOS os produtos da categoria.

---

## Planejado (precisa de dados Oracle / agregações)

Quatro "buscas inteligentes" como abas/opções no diálogo, cada uma devolvendo uma
lista de produtos ordenada:

- **Produtos mais vendidos** — ranking por quantidade/valor vendido num período.
- **Produtos próximos do vencimento** — por data de validade do lote/estoque.
- **Produtos com maior giro** — giro = vendas ÷ estoque médio (período).
- **Produtos com menor giro** — o inverso.

### O que já existe no projeto

- Integração Oracle para dashboards: `src/app/router/dashboard-widgets/_oracle-*.ts`,
  `oracle-explorer/*`, models `OracleQueryTemplate` / `OracleWidgetSnapshot`.
- Models locais `Sale` / `SaleItem` (vendas) e `Product` (estoque atual) — dá para
  calcular "mais vendidos" e "giro" SEM Oracle se as vendas estiverem no Postgres.
- `products.list` já filtra por categoria (slug).

### Decisões a tomar (antes de implementar)

- **Fonte de cada métrica:** Oracle (via `OracleQueryTemplate`) vs. agregação local
  (`SaleItem`)? "Vencimento" provavelmente só existe no Oracle (lote/validade);
  "mais vendidos"/"giro" podem sair de `SaleItem` local.
- **Período** (7/30/90 dias?) e **como expor** no diálogo (abas vs. dropdown "Ordenar por").
- **Novo procedure** `promotional-catalog/smart-product-search` (input: modo + período +
  categoria; output: lista de produtos já no formato do diálogo) — ou estender
  `products.list` com `sortBy: "best-sellers" | "near-expiry" | "turnover-desc" | "turnover-asc"`.
- **Credenciais/host Oracle**: confirmar acesso (ver `scripts/check-existing-oracle-host.ts`).

### Critérios de aceite (MVP)

- [ ] No diálogo, abas/dropdown: Buscar | Mais vendidos | Próx. vencimento | Maior giro | Menor giro.
- [ ] Cada modo lista produtos ordenados pela métrica, respeitando o filtro de categoria.
- [ ] "Adicionar" e "Adicionar todos" continuam funcionando em cada modo.
- [ ] Métrica calculada no servidor (multi-tenant por `organizationId`).
- [ ] `biome` + `tsc` limpos.

### Riscos

- Depende de dados Oracle (vencimento) — pode ficar bloqueado por credencial.
- Giro precisa de estoque médio no período (histórico), não só o estoque atual.
