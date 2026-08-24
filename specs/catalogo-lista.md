# Aba "Lista": planilha/PDF/imagem → catálogo promocional automático

> Feature: `src/features/promotional-catalog` · Status: 🟢 MVP entregue (Fases 1-4)

Transforma uma **planilha (.xlsx/.csv)** ou um **encarte em PDF/imagem (.pdf/.jpg)** num
catálogo promocional: **uma página por cliente**, produtos do cliente, **preços por linha**
(sem alterar o preço do cadastro) e **imagens** casadas pelo nome do produto.

## Como funciona
- Aba **"Lista"** no rail do editor (`EDITOR_TABS`); ao clicar, a área central vira uma
  **planilha** (o preview/painel some).
- **Importar:** planilha → parse client-side (SheetJS) + **mapeamento de colunas**
  (`catalog-list-fields.ts`, auto-detecção por sinônimos). PDF/imagem → **Gemini** extrai as
  ofertas estruturadas (`extract-offers-vision.ts`, mesmo padrão de
  `shopper/identify-product-vision.ts`; sem mapeamento).
- **Tabela editável:** produto, preço normal/oferta, departamento, cliente; adicionar/remover
  linhas; **Sincronizar imagens** (`matchProductsByName` em lote, por nome). **Máx./página**
  (auto = maior cliente, editável). Tudo salvo em `config.list` (autosave).
- **Gerar catálogo:** `generateCatalogFromList` monta 1 `CatalogPage` por cliente (modo
  explícito `productIds`), `layout:"custom"`, `gridCols:3`, `gridRows:ceil(max/3)`, último
  item centralizado (`loneLast`).

## Produto virtual (chave do design)
Cada linha vira um **`CatalogProduct` virtual** (`virtualProductsFromList` em `types.ts`),
definido no `config` — não no banco. Mesmo produto com preços diferentes por cliente = linhas
distintas. Matched traz a `thumbnail` do cadastro (embutida); sem match → mockup. Injetado no
pool de produtos no editor (`catalog-editor.tsx`) e no render público (`public-promo-catalog.tsx`).

## Arquivos
- `types.ts` (`CatalogListItem`, `config.list`, `virtualProductsFromList`), `lib/layout.ts`
  (distribuição por `productIds`), `catalog-list-fields.ts`, `components/catalog-list-editor.tsx`,
  `catalog-editor.tsx` (aba + geração + injeção), `components/public-promo-catalog.tsx`.
- Backend: `app/router/promotional-catalog/{match-products-by-name,extract-offers-from-file}.ts`,
  `server/extract-offers-vision.ts`, hooks em `hooks/use-catalog.ts`. **Sem migration**
  (tudo no `config` Json). Env `GEMINI_API_KEY` (já usado) para PDF/imagem.

## IA de extração (PDF/imagem)
- `extract-offers-vision.ts`: tenta **Gemini** (chave `GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`)
  e cai para **OpenAI** (`OPENAI_API_KEY`, `gpt-4o-mini`, com PDF via *file input*). Timeout 180s.
- Testado com o encarte real (8 páginas): OpenAI extraiu **221 ofertas / 27 clientes em ~148s**
  (F S COMERCIAL = 8 ✓). É lento → a UI mostra "Lendo o arquivo com IA…". `maxDuration=300` na
  rota `/api/rpc` para não ser cortado na Vercel (requer plano que permita).
- **Melhoria futura:** transformar a extração em job de background (padrão Inngest do import de
  fornecedores) com polling, em vez de request síncrono de ~2-3 min.

## Pendências / próximos passos
- Match por nome é best-effort (2 primeiras palavras + trigram) — conferir na tabela.
- Preço único no encarte cai em `normalPrice` (offerPrice null) — o card mostra o preço, mas sem
  destaque de promoção; ajustar o prompt se quiser tratar preço único como oferta.
- Datas início/fim ficam na lista mas ainda **não** viram validade automática (risco de
  formato) — ver `offerValidUntil`.
- "Departamento" ainda não agrupa/ordena; UI mobile da aba é limitada (editor é desktop-first).
- PDFs grandes (>~8MB) passam do limite inline do Gemini → orientar planilha.
- Vincular "Cliente" ao `Customer` do banco (hoje só nome) exigiria busca por nome de Customer.
