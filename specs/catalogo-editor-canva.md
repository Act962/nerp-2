# Editor de Catálogo estilo Canva — camadas, seleção e propriedades

> Transformar o editor do Catálogo Promocional num editor de camadas estilo Canva:
> cada página tem 4 camadas selecionáveis (Fundo, Grupo de produtos, Card, Elementos),
> com bounding box + nós de redimensionamento no hover e uma aba de propriedades
> compartilhada (cores, contorno, raio, transparência, cortar, inverter, z-order).
> Épico — várias sessões/branches.
> Feature: `src/features/promotional-catalog` + `src/app/router/promotional-catalog`
> Branch base: continuação de `feat/catalogo-paginas-canva`
> Criado em: 2026-08-20 · Atualizado em: 2026-08-20
> Status: 🟡 Em andamento (Fases 1-5 entregues; refinos abaixo)

---

## Situacao atual

O editor (`catalog-editor.tsx`) já evoluiu bastante:

- **Fase 1 (entregue):** páginas independentes (`pages[]` no `config` JSON). Cada página
  tem Disposição, Fundo e Etiquetas próprios; barra por página (nome, ordenar, inserir,
  bloquear, duplicar tudo/só fundo, excluir). Produtos fluem automaticamente pelas páginas.
- **Fase 2 (entregue):** Disposição **Personalizado (grade)** — o usuário escolhe
  colunas × linhas; itens por página = cols × linhas.

O que já dá para reaproveitar nas próximas fases:

- **Etiquetas/Elementos** já têm arrastar + nós de redimensionamento + rotação
  (`components/overlay-editor.tsx`, tipo `Overlay` em `types.ts`: x/y/w/h/rotation em px
  no canvas 1080×pageH). Falta a **aba de propriedades**.
- **Foto por produto** já tem ajuste não-destrutivo (`imageAdjustments`: scale/posX/posY/fit
  em `types.ts`). Serve de base para o **popup da foto** ao clicar no card.
- **Fundo por página** e **auto-flow de produtos** prontos.

Arquivos principais:
- `src/features/promotional-catalog/catalog-editor.tsx` — orquestra páginas, config e preview.
- `src/features/promotional-catalog/components/catalog-preview.tsx` — renderiza o canvas.
- `src/features/promotional-catalog/components/config-panel.tsx` — abas Produtos/Layout/Padrões/Etiqueta.
- `src/features/promotional-catalog/components/overlay-editor.tsx` — camada de etiquetas (drag/resize).
- `src/features/promotional-catalog/components/page-toolbar.tsx` — barra por página.
- `src/features/promotional-catalog/types.ts` — `CatalogConfig`, `CatalogPage`, `Overlay`, `PER_PAGE_KEYS`.

---

## Visao alvo — as 4 camadas

Cada **página** de catálogo é uma pilha de 4 camadas. Em todas: **hover** desenha um
retângulo com nós de redimensionamento; **clique** seleciona e abre a aba de propriedades
contextual; arrastar move.

| Camada | Hover | Clique | Observação |
|---|---|---|---|
| **Fundo** | — | edita cor/imagem | já existe (por página) |
| **Grupo de produtos** (PAI) | retângulo em volta de toda a área de produtos + nós | arrasta/redimensiona o grupo | ao redimensionar o pai, **os cards filhos se auto-ajustam** |
| **Card do produto** (FILHO) | retângulo circundando os elementos do card + nós | abre o **popup da foto** do produto | herda geometria do grupo pai |
| **Elementos** (etiquetas) | retângulo em volta do elemento + nós | edita aquele elemento | já tem drag/resize; falta painel |

**Aba de propriedades compartilhada** (abre para a camada/elemento selecionado, variando
o que se aplica por tipo): **cores, contorno, arredondamento de canto, transparência,
cortar (crop), inverter (flip), posição (z-order / “surge camadas”)**.

---

## Pendencias (faseado)

### Fase 3 — Sistema de seleção de camadas (fundação) · ✅ Entregue (2026-08-20)

- [x] **Modelo de seleção** — `LayerSelection` em `types.ts` (`background | group | card | element`,
  com `id` para card/element); estado `selection` no `catalog-editor.tsx`.
- [x] **`SelectionLayer`** (`components/selection-layer.tsx`) — generaliza o antigo
  `overlay-editor.tsx` (removido). Sobre o preview visível (fora do ref exportado). Mede o
  `[data-role="product-group"]` e seus filhos (cards) via DOM → desenha bounding box de
  **hover** (tracejado) e **seleção** (sólido) para Grupo e Card; Elementos mantêm
  mover/redimensionar/girar/excluir. Prioridade de hit-test: Elemento > Card > Grupo > Fundo.
- [x] **Clique seleciona + abre a aba** — `handleSelectionChange` roteia: element→Etiqueta,
  card→Produtos, group/background→Layout (e reabre o painel).
- [x] `data-role="product-group"` marcado nos wrappers de grade do `catalog-preview.tsx`.
- Verificado no browser: card e grupo selecionam com box + rótulo "Grupo de produtos" + troca de aba.
- **Adiado p/ Fase 5** (só faz sentido com a propagação pai→filho): persistir a geometria
  `productGroup: {x,y,w,h}` no `CatalogPage` e mover/redimensionar o grupo. Na Fase 3 o box do
  grupo é medido do DOM (preciso), sem persistência.

### Fase 4 — Painel de propriedades · ✅ Entregue (2026-08-21, elementos)

- [x] **`ElementProperties`** (`components/element-properties.tsx`) — painel contextual que
  aparece na aba Etiqueta quando um Elemento está selecionado. Controles: **transparência**
  (0-100), **arredondamento** (raio px), **contorno** (espessura + cor), **girar** (0-359°),
  **inverter** (H/V) e **camadas** (z-order: Frente/Trás, reordenando o array de overlays).
- [x] **`Overlay` estendido** em `types.ts`: `opacity?`, `radius?`, `borderWidth?`,
  `borderColor?`, `flipH?`, `flipV?` (todos opcionais; ausentes = sem efeito).
- [x] Aplicado no `catalog-preview.tsx` (mesmo trecho do preview e do export → idêntico):
  opacity, borderRadius, border e transform (rotate + scaleX/scaleY para flip).
- [x] `SelectionLayer.onDrop` agora cria o overlay mesmo se a imagem falhar ao carregar
  (`onerror` → quadrado padrão) — antes sumia silenciosamente com o bucket offline.
- Verificado no browser: contorno 12px + raio 66px aplicaram ao vivo; painel some ao excluir.
- **Fica para depois** (não aplicável só a etiqueta): propriedades por **Card** e **Grupo**
  (precisam de `cardStyleOverrides`/`productGroup.style`); **cores de preenchimento** e
  **cortar (crop)** do elemento (PNG — recolor/crop não-triviais).

### Fase 5 — Grupo pai + popup da foto · ✅ Entregue (2026-08-21)

- [x] **Geometria do grupo** — `productGroup?: {x,y,w,h}` (`LayerRect`) no `CatalogConfig`/
  `CatalogPage`, em `PER_PAGE_KEYS`. Ausente = fluxo padrão; ao mover/redimensionar pela
  primeira vez, deriva o rect do DOM e passa a persistir.
- [x] **Grupo como container pai** — quando `productGroup` existe, `catalog-preview.tsx`
  posiciona a grade absolutamente no rect (`overflow:hidden`). No layout **custom**, a grade
  preenche o box com `gridTemplateColumns/Rows: repeat(n, 1fr)` → redimensionar o grupo
  **escala os cards filhos**. `SelectionLayer`: alça de mover (o rótulo "Grupo de produtos")
  + alça de redimensionar (canto), via novos drags `group-move`/`group-resize` → `onGroupChange`.
- [x] **Redefinir posição do grupo** — botão na aba Layout (limpa `productGroup` → volta ao fluxo).
- [x] **Popup da foto ao clicar no card** — `ProductPhotoButton` virou controlável (`open`/
  `onOpenChange`); clicar no card abre o editor de foto daquele produto (reusa
  `imageAdjustments`: Cobrir/Caber, zoom, posição, remover fundo). Sincronizado com a seleção
  do canvas via `onSelectionChange` (abrir/fechar = selecionar/limpar o card).
- Verificado no browser: mover o grupo (6 cards juntos), redimensionar (cards escalam),
  reset, e popup da foto abrindo/fechando ao clicar no card.

---

## Decisoes tomadas

- **Disposição = grade manual (cols × linhas), controlando itens por página** — slots vazios
  ficam em branco; produtos fluem para a próxima página. (Fase 2, entregue.)
- **Produtos fluem automaticamente pelas páginas** (sem seleção manual de produto por
  página nesta linha de trabalho). (Fase 1.)
- **Camadas por página** — geometria e estilo de cada camada vivem no `CatalogPage`, não no
  global, respeitando “controle apenas para a página”.
- **Reusar o motor de nós do `overlay-editor`** para todas as camadas, em vez de uma lib nova.

---

## Chrome estilo Canva (entregue 2026-08-21)

- [x] **Cabeçalho da página** dentro da área cinza do preview, acima do canvas
  (`components/page-toolbar.tsx`): nome + **Disposição** (layout, com Colunas×Linhas quando
  custom) + **Ordenação** (sortBy) + ordenar/inserir/bloquear/duplicar/excluir + navegação.
- [x] **Barra flutuante do elemento** (`components/element-toolbar.tsx`) sobre a etiqueta
  selecionada: **Editar** (popover com as propriedades da Fase 4), **Inverter** (H/V),
  **Camadas** (frente/trás), **Alinhar à página** (esq/centro/dir + topo/meio/base),
  **Duplicar**, **Excluir** e menu **"…"**. Renderizada no `SelectionLayer` (fora do export).
  Novos handlers no SelectionLayer: duplicar/reordenar/alinhar overlay (usa `pageH`).

## Editor de Card no popup (entregue 2026-08-21)

- [x] Popup ao clicar no card (`ProductPhotoButton` em `config-panel.tsx`) virou **editor de
  card**: **prévia do card ao vivo** (reusa `renderCard`, agora exportado de
  `catalog-preview.tsx`) que reflete preços/cores/foto na hora; **Preços** De/Por;
  **Cores** (variante plain/boxed/highlight + cor do preço/borda/texto + fundo do card);
  **Foto** com **menu no hover** (Enviar do computador, Buscar na Web, Remover fundo, Caber,
  Cobrir, Zoom, Posições) e **nós de redimensionar/cortar** sempre visíveis (arrastar canto = zoom).
- Verificado no browser: menu no hover, nós, e edição de cor refletindo na prévia ao vivo.

## Proximos passos (refinos)

1. Propriedades por **Grupo** (fundo/contorno do container) + crop-rect real da etiqueta.
2. (Card já tem editor próprio no popup; falta apenas expor no pill flutuante se desejado.)
2. Redimensionar páginas por drag na tira lateral + miniaturas de páginas.
3. Grupo pai: escalar cards também nos layouts não-`custom` (hoje só custom preenche o box).

---

## Melhorias futuras (nao urgentes)

- [ ] Reordenar páginas por drag (hoje é ↑/↓ na barra).
- [ ] Miniaturas de páginas (tira lateral estilo Canva).
- [ ] Seleção manual de quais produtos entram em cada página (quebra o auto-flow — decisão à parte).
- [ ] Camadas nomeadas / painel de camadas explícito (lista de z-order).
