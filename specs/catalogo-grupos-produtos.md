# Grupos de Produtos — Catálogo Promocional

> "+ Adicionar Grupo" na aba Produtos: seleção múltipla de produtos (Shift+clique) e
> agrupamento nomeado/renomeável; uma página pode ter vários grupos (ex.: por categoria).
> Feature: `src/features/promotional-catalog`
> Criado em: 2026-08-23 · Atualizado em: 2026-08-23
> Status: 🟡 Em andamento

---

## Situacao atual

Hoje `ProductGroup` (`types.ts`) é só uma REGIÃO de grade posicionável
(`{ id, rect, gridCols, gridRows }`) — os produtos "fluem" nela por capacidade
(`pageChunks` soma `gridCols*gridRows` de cada grupo). Não há grupo NOMEADO com
produtos ESPECÍFICOS atribuídos, nem seleção múltipla de produtos na aba Produtos.

Arquivos principais:
- `src/features/promotional-catalog/types.ts` — `ProductGroup`, `CatalogConfig.productGroups` (por página)
- `src/features/promotional-catalog/components/config-panel.tsx` — aba "Produtos" (lista + "+ Adicionar produto")
- `src/features/promotional-catalog/catalog-editor.tsx` — `pageChunks` distribui produtos; `handlePageConfigChange`
- `src/features/promotional-catalog/components/selection-layer.tsx` — grupos no canvas
- Config é JSON livre (`update.ts` faz merge) → **sem migração**.

---

## Criterios de aceite

- [x] Botão **"+ Adicionar Grupo"** abaixo de "+ Adicionar produto" na aba Produtos.
- [x] **Seleção múltipla** de produtos na lista: checkbox por linha **e Shift+clique**
      (range) funcionando.
- [x] "Adicionar Grupo" cria um grupo com os produtos selecionados; o grupo tem
      **nome editável** (renomear inline).
- [x] Uma página pode ter **vários grupos**; produtos de um grupo aparecem na sua
      região (slice por pertencimento em `CatalogPreview`).
- [x] Remover grupo (card na aba Produtos). Renomear inline.
- [ ] Mover produto entre grupos / desagrupar (parcial: recriar o grupo).
- [ ] Ordem/preços sincronizados — mantidos (grupos não mexem em preço).

Falta refinar (precisa de teste visual, preview deslogado): posição/tamanho das
regiões dos grupos (hoje auto-empilhadas, arrastáveis) e o layout dos NÃO agrupados
(hoje vão pro último grupo pra não sumir).

---

## Decisoes tomadas

- **Estender `ProductGroup`** com `name?: string` e `productIds?: string[]` (grupo
  nomeado com produtos próprios). Grupos SEM `productIds` seguem o comportamento
  antigo (região por capacidade) — retrocompatível.
- **Config-only** — nenhuma migração; `productGroups` já é por página no JSON.

---

## Proximos passos

1. Estender o tipo `ProductGroup` (`name`, `productIds`).
2. Estado de seleção múltipla na lista de Produtos (checkbox + Shift+range).
3. "+ Adicionar Grupo" → cria grupo com a seleção; card de grupo com renomear/excluir.
4. `pageChunks`: quando um grupo tem `productIds`, renderiza esses produtos na sua
   região; o resto flui normalmente.
5. Validar tsc + biome; testar no navegador (quando logado).

---

## Melhorias futuras (nao urgentes)

- [ ] Auto-agrupar por categoria (um clique cria grupos por `categoryName`).
- [ ] Arrastar produtos entre grupos.
