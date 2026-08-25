# Book — Melhorias 2 (páginas por loja, tipos de mídia, fotos da loja, fix do Editar)

> Quatro melhorias no editor de Books (auto e manual): categorizar fotos por tipo
> de mídia na aprovação, gerenciar as fotos da loja na página, adicionar página
> de uma loja/cliente, e corrigir o botão "Editar" que não abre a página.
> Feature: `apps/web/src/features/books` + `apps/web/src/app/router/book` + `apps/web/src/app/(main)/(rest)/books`
> Criado em: 2026-08-25 · Atualizado em: 2026-08-25
> Status: 🟢 Concluído (aguardando teste do dev + PR única)

---

## Situacao atual

O editor de Books tem duas gerações: **automática** (`book-page-card-v2.tsx`, `BookPagesListV2`) e **manual/legada** (`book-page-card.tsx`, `BookPagesList`). Fotos entram pelo fluxo do promotor e são aprovadas na fila da coordenadora (`photos-for-approval.tsx`). Tipos de mídia (biblioteca nacional) vivem em `media-model-photo` / `MediaModel` (Trade > Cadastros de Trade); `PdvPhoto.mediaTypeId` já existe.

Arquivos principais:
- `apps/web/src/features/books/components/book-pages/book-page-card-v2.tsx` — página no editor (modelo novo)
- `apps/web/src/features/books/components/book-pages/book-page-card.tsx` — página (modelo legado)
- `apps/web/src/features/books/components/book-pages/page-layout-editor.tsx` — editor de layout da página (fundos/imagens/textos)
- `apps/web/src/features/promotor/components/photos-for-approval.tsx` — card de aprovação (Reprovar/Aprovar)
- `apps/web/src/app/router/book/{add-page,add-extra-page,import-photos,set-slot-photo}.ts`
- `prisma/schema.prisma` — `Book`, `BookPage`, `BookItem`, `PdvPhoto`, `MediaModel`/`MediaModelPhoto`

---

## Pendencias

### Critico

- [x] **#4 — "Editar layout" nas páginas V2** — ✅ 2026-08-25. Decisão: adicionar o botão ao card V2 (auto + manuais novas), que não tinha edição de layout. Novo `book-page-layout-dialog.tsx` (espelha o `PageItemLayoutDialog` legado) salva o layout PRÓPRIO da página via `orpc.book.updateBookPageLayout` (hook `useUpdateBookPageOwnLayout`). Abre mostrando fundo/imagens/textos da página clicada.

### Funcional

- [x] **#2 — Categorizar foto por tipo de mídia na aprovação + favoritos** — ✅ 2026-08-25. Migração `MediaType.isFavorite` (favorito por org). `media-type/list` devolve `isFavorite` (favoritos primeiro) + nova mutation `toggleFavorite`. Novo componente reutilizável `MediaTypeSelect` (favoritos → "ver todos" → estrela) no `PhotoCard` do card de aprovação, gravando `PdvPhoto.mediaTypeId` via `pdv-photo/update`. `for-approval` passou a devolver o mediaType atual.
- [x] **#3 — Botão "Fotos desta loja/cliente" na página** — ✅ 2026-08-25. Novo `book-store-photos-dialog.tsx`: grid das fotos aprovadas da loja (via `approved-for-import`, estendida com `mediaType`), filtro por tipo de mídia (reusa `MediaTypeSelect`), selecionar todas e excluir (`pdv-photo/delete`). Botão "Fotos desta loja" ao lado do "Caber inteira" no card V2 (`book-page-card-v2.tsx`) e no card legado (`book-page-card.tsx`, com `storeId` agora exposto pelo `book/get`). Vale para auto e manual.
- [x] **#1 — Botão "Adicionar página" de uma loja/cliente + indústria** — ✅ 2026-08-25. O router `book.addPage` (`add-page.ts`) já criava a `BookPage` por loja seguindo o layout do book (= indústria); faltava o botão no fluxo **V2/auto**. Reusei o `AddPageSheet` (escolhe loja/cliente com busca, cria loja na hora, tipo de mídia, fotos e padrão opcional) no `BookPagesListV2`, e ajustei o `book-editor` para renderizar a lista V2 (com o botão "Adicionar página" e a orientação de "Gerar automático") também no book vazio. Duplicar página fica só no legado (duplica como item solo).

### Adicionais (mesma branch, pedidos durante a implementação)

- [x] **#5 — Aviso de foto repetida no book (avisar + permitir)** — ✅ 2026-08-25. `approved-for-import` aceita `bookId` e devolve `usedInBook` por foto. No picker "Adicionar foto" (`ImportPhotoDialog`, V2 + legado): badge **"Já usada"** e um confirm **"Adicionar mesmo assim"** ao escolher uma foto já presente em qualquer página do book (não bloqueia). Na "Fotos desta loja" (#3), badge **"No book"** (informativo). Decisão do dev: **avisar + permitir** (repetir às vezes é intencional).
- [x] **#8 — Botão "Adicionar página" suspenso + inserir-após (estilo Catálogo)** — ✅ 2026-08-25. Cada card V2 ganhou um botão flutuante "Adicionar página" sobre a prévia (estilo Catálogo Promocional) que insere a página **logo após aquela**; `book.addPage` passou a aceitar `afterPageId` (renumera as seguintes numa transação). O botão tracejado no rodapé segue existindo (adiciona no fim).
- [x] **#7 — Lupa de inspeção (zoom no hover de 2,5s)** — ✅ 2026-08-25. Novo `hover-zoom.tsx`: com o mouse parado ~2,5s sobre a prévia da página, aparece um quadrado com o zoom do ponto sob o cursor, que depois acompanha o cursor até sair. Reaproveita a própria prévia (`LayoutPreview` é posicionada em `cqw`, então escala sozinha num container maior — sem captura de imagem), via portal e sem interceptar cliques. Aplicado ao card V2 (`book-page-card-v2.tsx`); o card legado (prévia 960×540 em modo imagem) fica de fora por não ser `cqw`.
- [x] **#6 — Reordenar páginas por busca + arrastar + posição** — ✅ 2026-08-25. Novo `reorder-pages-dialog.tsx`: lista as páginas com **busca por nome**, **drag-and-drop** (dnd-kit, alça por linha), **posição digitável** (digita o número → move) e setas topo/subir/descer/fim; a ordem só é aplicada ao **Salvar**. Botão "Reordenar páginas" nas duas listas (V2 via `reorderPages`, legado via `reorderItems`) quando há +1 página — as setas ↑/↓ por card não escalam para books de ~100 páginas. O drag respeita a busca (solta na posição global do alvo).

---

## Ordem de ataque

1. **#4** (bug do Editar) — destrava a edição.
2. **#2** (tipo de mídia + favoritos na aprovação) — infra reusada pelo #3.
3. **#3** (fotos desta loja, com filtro de tipo de mídia) — reusa o #2.
4. **#1** (adicionar página da loja/cliente).

---

## Decisoes tomadas

- **Um spec para as 4 melhorias**, atacadas uma a uma na branch `feat/book-melhorias-2` (monorepo).
