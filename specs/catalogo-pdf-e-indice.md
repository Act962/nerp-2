# Catálogo Promocional — PDF leve e página de índice navegável

> PDF de centenas de MB em 9 arquivos → **um arquivo** na casa dos 40 MB; e uma
> página de **índice** posicionável, clicável no PDF e no link online.
> Feature: `src/features/promotional-catalog`
> Branch: `feat/catalogo-publico-buscar-produto`
> Criado em: 2026-09-09 · Atualizado em: 2026-09-09
> Status: 🟡 Código pronto — falta o dev testar com dados reais

---

## Situacao atual

O "CATÁLOGO ARMAZÉM CARVALHO 2026" tem **222 páginas** e ~2.462 imagens. Baixar
em PDF era inviável: o export fatiava em 9 arquivos de centenas de MB. E num
encarte desse tamanho não havia como achar nada.

Medi o tamanho rasterizando 21 páginas reais no navegador (fundo + conteúdo
compostos, mesmo canvas 1080×1526 do export). O catálogo é **capa + 107 páginas
com foto de fundo + 114 sem**:

| | resolução | DPI | 222 páginas |
|---|---|---|---|
| PNG (como era) | 2400 | 213 | **~440 MB**, em 9 arquivos |
| Máxima — q0,92 | 2400 | 213 | ~65 MB |
| **Alta — q0,88 (default)** | **2160** | **192** | **~42 MB** |
| Equilibrada — q0,82 | 1620 | 144 | ~21 MB |
| Leve — q0,72 | 1296 | 115 | ~11 MB |

---

## Decisoes tomadas

- **JPEG, não PNG.** O jsPDF embute JPEG verbatim (DCTDecode); PNG ele
  DECODIFICA e re-comprime em JS puro com deflate pior que o do navegador, e
  ainda gera um SMask por causa do alfa. Era o gargalo real — `compress: true`
  quase não ajuda, porque `putImage` remove `FlateEncode` da imagem.
- **`backgroundColor: "#ffffff"` na captura** é obrigatório: JPEG não tem alfa e
  o catálogo tem transparência real (opacidade do fundo, "remover fundo"). Sem
  isso a página sai preta.
- **Default "Alta" e não "Equilibrada":** a 2160 px já cabe em ~42 MB. O pedido
  era reduzir *sem perder qualidade*; cortar resolução por padrão seria pagar um
  preço que a troca de formato já dispensou.
- **Um arquivo sempre.** `EXPORT_BATCH` virou `DOM_BATCH` — decide só quantas
  páginas ficam montadas no DOM, não o arquivo. O orçamento de 46 MB é
  guarda-costas: só age em catálogo mais pesado que o preset previu.
- **Zipar o PDF não vale** — JPEG já está comprimido, rende 2-5%.
- **A página de índice é uma `CatalogPage` de verdade.** É a decisão que carrega
  o resto: o `CatalogPreview` sabe desenhá-la, então ela entra no editor, no
  link público, no PDF, no PNG e no zip sem caminho especial.
- **O índice conta a si próprio.** Inserido depois da capa, a página 2 vira o
  índice e tudo que vinha depois desloca. É o que o leitor conta.
- **Modo por página, não por catálogo.** Cada página de índice tem seu
  `indexMode`; páginas de mesmo modo repartem as linhas entre si, modos
  diferentes são listas independentes.
- **O índice ocupa o `productGroup` da página.** Numa página de índice não há
  produto disputando o lugar, e o retângulo do grupo já tem moldura, alças de
  mover e de redimensionar na camada de seleção — reusar isso evitou uma
  segunda máquina de arrastar só para o sumário.
- **Diminuir a letra faz caber mais linhas**: a capacidade da página de índice
  é recalculada a partir do tamanho da fonte, senão reduzir o texto só deixaria
  espaço vazio no pé.
- **Números do índice são `<button>`**, não `div` com clique: teclado funciona
  de graça. Sem `onNavigate` (export) viram `<span>` — no PDF o número tem que
  ser só um número.
- **Online conta páginas VISÍVEIS; o PDF conta todas.** Página vencida some do
  link público, e o leitor conta o que vê. Os dois números podem divergir, e
  cada um está certo no seu meio.

---

## Pendencias

### Critico

- [x] JPEG + presets + arquivo único (`hooks/use-export.ts`) — ✅ 2026-09-09
- [x] Página de índice como `CatalogPage` (`types.ts`, `lib/catalog-index.ts`,
      `components/catalog-index-body.tsx`) — ✅ 2026-09-09
- [x] Links clicáveis no PDF (`pdf.link` com `pageNumber`) — ✅ 2026-09-09
- [x] Índice clicável e "Ir ao topo" no link público — ✅ 2026-09-09

### Funcional

- [x] Índice não recebe produto (`lib/page-chunks.ts`) — a última página engolia
      os não atribuídos nos DOIS modos de distribuição. — ✅ 2026-09-09
- [x] Reconciliador de órfãos ignora o índice (`catalog-editor.tsx`) — ✅ 2026-09-09
- [x] **Índice editável** (`components/index-properties.tsx`) — trocar o modo
      depois de criado, tipografia (fonte, tamanho, cor, colunas) e posição.
      Fundo e título "ÍNDICE" NÃO ganharam controle próprio: já são da página
      (abas Fundo e Texto, ambas por página). — ✅ 2026-09-09

- [x] **Teto duro de 400 páginas por arquivo** — válvula de memória, não de
      tamanho: o payload vive uma vez no jsPDF e outra no `output()`, e um
      catálogo de 474 páginas (existem) derrubaria a aba. Acima do teto o
      download volta a ser fatiado, e os links do índice passam a apontar para
      a página DENTRO do arquivo — alvo em outro arquivo não vira link, em vez
      de virar link errado. — ✅ 2026-09-09
- [x] **Regra do "nome genérico de página" unificada** (`pageNameIsGeneric`) —
      estava duplicada entre o índice e o buscador do link público, que assim
      podiam chamar a mesma página por nomes diferentes. — ✅ 2026-09-09

### Nao feito (de proposito)

- [ ] **Marcadores na barra lateral do PDF** (outline do jsPDF). O plano já o
      trazia como "incluir se couber, não bloqueia". Numa PR deste tamanho,
      preferi não acrescentar superfície nova sem conseguir testar o PDF.

### Bugs anteriores corrigidos junto

- [x] **DPI da página avulsa** — `printPage`/`exportPageAsPdf` mediam por
      `naturalWidth` (a captura) e não por `offsetWidth` (o layout): a página
      saía com 635 mm, 2,2× maior que as 285,75 mm do catálogo. — ✅ 2026-09-09
- [x] **Export pendurava em aba de segundo plano** — `waitForExportReady`
      esperava `requestAnimationFrame`, que não dispara com a aba escondida; o
      prazo de 12 s nunca era reavaliado. Num export de minutos, trocar de aba
      era garantido. — ✅ 2026-09-09

---

## Proximos passos

1. Dev exportar o Armazém Carvalho e conferir: **um arquivo**, ~42 MB, links do
   índice funcionando no Adobe Reader, Preview do macOS e Chrome.
2. Zoom 100% no preço vermelho/amarelo, comparando Alta e Equilibrada.
3. Índice nos três modos, com a página em posições diferentes — inclusive a
   última, que é a que exercita a armadilha da distribuição.

---

## Melhorias futuras (nao urgentes)

- [ ] Marcadores na barra lateral do PDF (o jsPDF tem API de outline).
- [ ] Resize no proxy `/api/s3/image` (`?w=` + `sharp`): 2.462 miniaturas
      descem em tamanho cheio hoje. É o maior ganho de tempo e memória.
- [ ] `compressImage` no upload de fundo — os fundos são PNGs de até 2,9 MB.
- [ ] `PAGE_W`/`pageHeightOf` estão duplicados entre `catalog-editor.tsx` e
      `catalog-preview.tsx` (anterior a este trabalho; agora exportados de um
      lado, dá para unificar).
