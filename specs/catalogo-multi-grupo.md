# Página com múltiplos grupos de produtos + blocos de estilo individuais

> Hoje cada página do Catálogo Promocional tem **um único** "Grupo de produtos"
> (`config.productGroup`) e o card livre é **um desenho global** (`config.cardLayout`)
> aplicado a todos os produtos. O usuário precisa: (1) **duplicar o grupo** — ter
> **vários grupos** na mesma página, cada um com sua disposição e seu conjunto de
> produtos; e (2) **inserir blocos de estilo individuais** — colocar um estilo salvo
> como um bloco posicionável na página, ligado a um produto específico, além dos grupos.
> Épico — muda o modelo da página (render, seleção, arrasto/resize, persistência).
>
> Feature: `src/features/promotional-catalog`
> Branch alvo: `feat/catalogo-multi-grupo` (nova)
> Criado em: 2026-08-21 · Atualizado em: 2026-08-21
> Status: 🟡 Fases 1 e 3 entregues (múltiplos grupos + blocos individuais). Fase 2
>   (atribuição MANUAL de produtos por grupo) e refino (proporção/z-order) pendentes.

---

## Entregue (Fase 1 — múltiplos grupos de produtos)

- **`ProductGroup`** (`types.ts`): `{ id, rect: LayerRect, gridCols, gridRows }` em px no
  canvas. Por página em `CatalogPage.productGroups` / `CatalogConfig.productGroups` (entrou em
  `PER_PAGE_KEYS` e na migração). `LayerSelection` `group` ganhou `id?` (identifica o grupo).
- **Duas trilhas, sem regressão**: página SEM `productGroups` → render/seleção do grupo único
  EXATAMENTE como antes (código intocado). Ao clicar **"Duplicar"** na moldura do grupo, a
  página migra para multi (`productGroups[0]` = grupo atual medido + um novo ao lado/abaixo).
- **Render** (`catalog-preview.tsx`): no multi, cada grupo é uma grade `data-group-id` posicionada
  no seu `rect`, com sua fatia de produtos (**auto-split sequencial** por `gridCols×gridRows`; o
  último leva o restante). Sai no export.
- **Seleção/edição** (`selection-layer.tsx`): no multi, cada grupo tem moldura própria — mover
  (arrasta de qualquer ponto), redimensionar (auto-grade: recalcula colunas/linhas), **duplicar**
  e **excluir**. Excluir o último volta ao grupo único.
- **Distribuição** (`catalog-editor.tsx`): `pageChunks` passa a consumir a soma das capacidades
  dos grupos no modo multi (a página puxa produtos suficientes p/ preencher todos os grupos).

Limites do MVP: card compartilhado; atribuição de produtos é auto-split (edição manual = Fase 2);
sem modo "proporção" nos grupos multi; seleção de card individual dentro de um grupo multi fica
para o refino.

---

## Entregue (Fase 3 — blocos de estilo individuais)

Implementado primeiro por ser de MENOR risco (reusa a máquina de elementos
posicionáveis já provada — etiquetas/textos) e atender diretamente ao pedido
"preciso adicionar novos estilos numa mesma página".

- **`StyleBlock`** (`types.ts`): `{ id, x, y, w, h, rotation, productId, cardLayout,
  opacity? }` em px no canvas 1080×pageH. Por página em `CatalogPage.styleBlocks` /
  `CatalogConfig.styleBlocks` (entrou em `PER_PAGE_KEYS`, `firstPageFromConfig` e
  `TEMPLATE_OMIT_KEYS`). Nova `LayerSelection` `{ kind: "styleBlock", id }`.
- **Render** (`catalog-preview.tsx`): cada bloco vira um card livre (`CardFreeLayout`)
  posicionado, resolvendo as variáveis do `productId` (fallback = 1º produto da página),
  dentro do `ref` exportado (sai no `html-to-image`).
- **Seleção/edição** (`selection-layer.tsx`): mover / redimensionar (livre) / girar /
  excluir — mesma pegada das etiquetas, via `styleBlocks`/`onStyleBlocksChange`.
- **Entrada** (`config-panel.tsx`): na aba "Estilos", "Adicionar estilo à página" agora
  cria um bloco posicionável (antes só empilhava elementos no card global — confuso).
  "Alterar todos os estilos da página" continua trocando o `cardLayout` global.

Card compartilhado no MVP (o bloco carrega o `cardLayout` do estilo escolhido).

---

## Situacao atual

- **Páginas** (`config.pages[]`, estilo Canva): cada uma tem `layout`/`gridCols`/`gridRows`/
  `productGroup`/`productGroupScale`/fundo/`overlays`/`texts` (ver `PER_PAGE_KEYS` em
  `types.ts`). `configForPage(i)` (em `catalog-editor.tsx`) monta a config efetiva da página.
- **Um grupo por página**: `config.productGroup?: LayerRect` (px no canvas 1080×pageH).
  Quando definido, a grade vira um bloco absoluto (`groupPos` em `catalog-preview.tsx`);
  senão, os produtos fluem na área de conteúdo.
- **Produtos fluem sequencialmente** pelas páginas (`pageChunks` em `catalog-editor.tsx`):
  cada página consome `cols×linhas` (ou o restante na última). Não há atribuição de produto
  a grupo.
- **`SelectionLayer`** (`components/selection-layer.tsx`) faz mover/redimensionar/proporção
  do grupo (um só), medindo `[data-role="product-group"]` no DOM do preview.
- **Card livre** (`config.cardLayout`): desenho único aplicado a TODOS os produtos
  (`renderCard` em `catalog-preview.tsx`). Estilos salvos (aba "Estilos") guardam
  `{ cardLayout }`; "Aplicar/Adicionar" mexem nesse layout global.
- **Etiquetas/Textos** (`overlays`/`texts`): elementos livres por página, posicionáveis —
  base pronta de "blocos posicionáveis" (drag/resize/rotação já existem no `SelectionLayer`).

Arquivos-chave: `catalog-editor.tsx` (páginas, `configForPage`, `pageChunks`, handlers de
grupo), `catalog-preview.tsx` (`renderCard`, `groupPos`), `selection-layer.tsx` (grupo),
`components/card-free-layout.tsx` (render do card), `types.ts` (`CatalogConfig`, `CatalogPage`,
`LayerRect`, `PER_PAGE_KEYS`, `CardLayoutElement`).

---

## Visao alvo

Uma página deixa de ter 1 grupo fixo e passa a ser uma **composição** de:

- **N Grupos de produtos** — cada grupo com seu retângulo, sua **disposição**
  (layout/cols/linhas/escala) e seu **conjunto de produtos**. "Duplicar grupo" cria outro.
- **Blocos de estilo individuais** — um estilo salvo (`cardLayout`) colocado como bloco
  posicionável na página, **ligado a um produto específico** (resolve as variáveis daquele
  produto), independente dos grupos.

Selecionar/mover/redimensionar cada grupo e cada bloco reusa o `SelectionLayer`.

---

## Modelo de dados (rascunho — no `config` JSON, sem migration)

```ts
type ProductGroup = {
  id: string;
  rect: LayerRect;          // px no canvas 1080×pageH
  layout: CatalogConfig["layout"];
  gridCols: number;
  gridRows: number;
  scale?: number;           // modo "proporção"
  productIds: string[];     // produtos atribuídos a este grupo (ordem)
};

type StyleBlock = {
  id: string;
  rect: LayerRect;          // px no canvas
  rotation?: number;
  productId: string;        // produto cujas variáveis o bloco resolve
  cardLayout: CardLayoutElement[]; // desenho (de um estilo salvo)
};
```

- `CatalogPage` ganha `productGroups?: ProductGroup[]` e `styleBlocks?: StyleBlock[]`
  (entram em `PER_PAGE_KEYS`).
- **Migração no load** (sem migration de banco): `productGroup` único → `productGroups[0]`
  (com todos os produtos que hoje caem na página). `cardLayout` global permanece como
  fallback do card dos grupos; blocos individuais guardam o próprio layout.
- **Atribuição de produtos aos grupos**: decisão aberta (ver Decisões) — auto-split
  sequencial por padrão + reatribuição manual.

---

## Fases

1. **Múltiplos grupos (render + seleção).** `productGroups[]`, "Duplicar grupo",
   render de N blocos (`catalog-preview.tsx`), `SelectionLayer` seleciona/moves/resize por
   grupo (hoje mede um; passar a mapear N via `data-role="product-group"` + `data-group-id`).
   Migração do grupo único.
2. **Atribuição de produtos por grupo.** UI para escolher quais produtos vão em cada grupo
   (auto-split sequencial default; arrastar/checar por grupo). `pageChunks` deixa de ser
   sequencial-global e passa a respeitar `productIds` por grupo.
3. **Blocos de estilo individuais.** Colocar um estilo salvo como `StyleBlock` (posicionável,
   ligado a um produto), render via `CardFreeLayout` com os dados daquele produto; seleção/
   move/resize/rotação/z-order reusando o `SelectionLayer`. A aba "Estilos" ganha "Inserir
   como bloco na página" (além de Alterar/Adicionar).
4. **Refino.** Duplicar/travar/alinhar grupos e blocos; z-order entre grupos, blocos,
   etiquetas e textos; snap/guias.

---

## Criterios de aceite (MVP — Fases 1-3)

- [x] "Duplicar grupo" cria um segundo grupo na página, com disposição e retângulo próprios.
- [x] Cada grupo move/redimensiona independentemente (escala/proporção fica p/ o refino).
- [~] É possível definir quais produtos aparecem em cada grupo — auto-split sequencial pronto;
      atribuição MANUAL (arrastar/checar por grupo) é a Fase 2.
- [x] "Inserir estilo como bloco" coloca um bloco posicionável ligado a um produto, que
      resolve as variáveis daquele produto e sai no export (`html-to-image`).
- [ ] Catálogos antigos abrem com o grupo único migrado para `productGroups[0]` sem perda.
- [ ] `pnpm biome check` + `npx tsc --noEmit` limpos; dev server no ar.

---

## Decisoes a tomar (antes de implementar)

- **Atribuição de produtos a grupos:** auto-split sequencial (grupo 1 = N primeiros, etc.)
  vs. seleção manual por grupo vs. por categoria. (Recomendado: auto-split + edição manual.)
- **Card dos grupos:** todos os grupos usam o `cardLayout` global? Ou cada grupo pode ter
  seu próprio card? (MVP: card global compartilhado; por-grupo depois.)
- **Fluxo entre páginas:** com grupos manuais, os produtos ainda "transbordam" para a
  próxima página, ou cada grupo é fixo na sua página? (Recomendado: fixo por grupo.)
- **Coordenadas:** manter px no canvas 1080×pageH (igual overlays/grupo atual).

---

## Riscos / gotchas

- `SelectionLayer` hoje assume **um** `[data-role="product-group"]`; passar para N exige
  medir/roteаr por `data-group-id` sem quebrar hit-test/hover.
- `pageChunks` (distribuição sequencial global) precisa conviver com atribuição por grupo.
- Export `html-to-image`: blocos e grupos precisam ser DOM no ref exportado (já é o caso).
- Migração do `productGroup` único e do `cardLayout` global — não perder catálogos atuais.
- Escopo por página (`PER_PAGE_KEYS`) e autosave do `config` continuam valendo.

---

## Proximos passos

1. Aprovar os **critérios de aceite** e as **decisões** (atribuição de produtos, card por
   grupo, fluxo entre páginas).
2. Abrir branch `feat/catalogo-multi-grupo`.
3. Implementar Fase 1 (múltiplos grupos) e validar antes de seguir.

---

## Melhorias futuras (nao urgentes)

- [ ] Card próprio por grupo (não só o global).
- [ ] Copiar/colar grupo entre páginas; duplicar página com os grupos.
- [ ] Snap/guias e alinhamento entre grupos, blocos, etiquetas e textos.
