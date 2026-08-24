# Construtor de "Padrão de estilos de preços" — canvas livre (variáveis + formas)

> Evoluir o construtor **"Padrão de estilos de preços"** (acessado pelo ícone de editar
> na *Prévia do card*, no modal do produto) de um formulário de opções para um **canvas de
> edição livre**: o usuário arrasta **variáveis** (Foto, Nome, Preço, SKU, Unidade, Código
> de barras, Preço De, Preço Promo, % desconto, Economize R$, Validade, Categoria) e
> **formas** (retângulo, quadrado, círculo, triângulo, contorno/linha, texto fixo),
> posicionando/redimensionando/girando cada elemento para montar o **bloco de oferta/preço**
> (como a arte de referência “Café Santa Clara 5,49 UND”). O layout vira um **padrão
> reutilizável** aplicado a todos os produtos — cada variável resolve o dado do produto no
> render.
> Épico — feature grande, várias sessões. **Estende/substitui** o `PriceStyleBuilder`
> simples (formas prontas) entregue na branch `feat/catalogo-paginas-canva`.
>
> Feature: `src/features/promotional-catalog` + `src/app/router/promotional-catalog`
> Branch alvo: `feat/catalogo-precos-livre` (nova)
> Criado em: 2026-08-21 · Atualizado em: 2026-08-21
> Status: 📋 Planejado (aguardando aprovação dos critérios de aceite)

---

## Situacao atual

O ícone de editar na *Prévia do card* (modal do produto) alterna a coluna direita para
**"Padrão de estilos de preços"**, hoje um `PriceStyleBuilder` **de opções fixas**: forma
do bloco de preço (`PriceStyle.shape`: retângulo/arredondado/selo/serrilhado),
preenchimento, contorno, cor do texto e tamanho. O botão **"Salvar padrão"** aplica o
estilo a todos os produtos (`config.priceStyle`). Não há edição livre, nem inserir outras
variáveis (Nome, Foto, SKU…), nem posicionar elementos.

O que já dá para **reaproveitar**:

- **`SelectionLayer`** (`components/selection-layer.tsx`) — drag/resize/rotate de `Overlay`
  e `TextElement` sobre o preview escalado, coordenadas px no canvas `1080×pageH`, alças,
  hit-test, seleção, escala proporcional. Base pronta do “mover/redimensionar por elemento”.
- **`PriceStyleBuilder` + `PriceStyle`** (`components/config-panel.tsx`, `types.ts`) — ponto
  de entrada e persistência atuais; o bloco de preço vira **um elemento** do canvas livre.
- **`renderCard` + `components/cards/*` + `price-display.tsx`** — render DOM. O export usa
  **`html-to-image`** (`use-export.ts`), então o canvas livre **precisa ser DOM** para
  exportar.
- **`CatalogProduct`** (`types.ts`) — fonte das variáveis.
- **Padrões org-level** — `promotionalCatalog.{listTemplates,createTemplate,updateTemplate,
  deleteTemplate}` (guardam `config` + `thumbnail`); base para persistir o padrão de bloco.

Arquivos principais:
- `src/features/promotional-catalog/components/config-panel.tsx` — modal do produto +
  `PriceStyleBuilder` (a evoluir para o canvas).
- `src/features/promotional-catalog/components/selection-layer.tsx` — drag/resize/rotate.
- `src/features/promotional-catalog/components/catalog-preview.tsx` + `components/cards/*`.
- `src/features/promotional-catalog/types.ts` — `CatalogConfig`, `PriceStyle`, `Overlay`,
  `TextElement`, `PER_PAGE_KEYS`.
- `src/app/router/promotional-catalog/template-*.ts` — CRUD de padrões (org-level).

---

## Visao alvo

O **"Padrão de estilos de preços"** deixa de ser um formulário e vira um **canvas livre**
que define um **bloco de oferta** — uma lista de **elementos** posicionados livremente
dentro de um retângulo. Cada elemento é uma **variável** (resolve um dado do produto), uma
**forma** ou **texto fixo**. O bloco é reutilizável e aplicado a todos os produtos; as
variáveis re-resolvem por produto no render.

- **Canvas do bloco**: retângulo com proporção configurável, mostrado na coluna direita do
  modal, com a *Prévia do card* ao lado atualizando ao vivo.
- **Paleta** (topo/lateral do construtor) em duas seções: **Variáveis** e **Formas** —
  arrastar da paleta para o canvas cria o elemento; arrastar dentro move; alças
  redimensionam/giram (reuso do `SelectionLayer`).
- **Propriedades** do elemento selecionado: cor, preenchimento, contorno (cor/espessura),
  raio, opacidade, fonte/tamanho/peso, alinhamento, z-order.
- **"Salvar padrão"**: persiste o bloco como **padrão reutilizável** (org-level, como os
  Padrões de catálogo) aplicado a todos os produtos.

### Catálogo de variáveis (→ fonte do dado)

| Variável | Fonte em `CatalogProduct` / config | Observação |
|---|---|---|
| Foto | `thumbnail` (via `constructUrl`) + `imageAdjustments[id]` | reusa ajuste não-destrutivo |
| Nome | `name` | |
| Preço (ativo) | `promotionalPrice ?? salePrice` | `formatPrice` |
| Preço (De) | `basePrice ?? salePrice` | riscado |
| Preço (Promo) | `promotionalPrice` | |
| SKU | `sku` | |
| Unidade | `unit` (`unitLabel`) | |
| % desconto | `discount` | |
| Economize R$ | `savings` | “Economize R$ 0,00” |
| Categoria | `categoryName` | |
| **Código de barras** | ⚠️ **não existe** em `CatalogProduct` | expor `ean`/`barcode` no `listProducts` + **gerador** (JsBarcode → SVG) |
| **Validade** | ⚠️ oferta é do catálogo (`offerValidUntil`), não do produto | decidir: validade da oferta (catálogo) vs. do produto (inexistente) |

### Formas / elementos base

- Retângulo, Quadrado, Círculo, Triângulo, Linha/Contorno (stroke), Texto fixo.
- Estilo por forma: preenchimento, contorno (cor/espessura), raio, opacidade, rotação.
  Triângulo/círculo via CSS (`clip-path`/`border-radius`) ou SVG inline — manter **DOM**
  para o `html-to-image`.

---

## Modelo de dados (rascunho)

No `config` JSON (sem migration de schema):

```ts
type OfferElement = {
  id: string;
  kind: "var" | "shape" | "text";
  // geometria dentro do bloco (decidir unidade — ver Decisões)
  x: number; y: number; w: number; h: number; rotation: number; z: number;
  variable?: "photo" | "name" | "priceActive" | "priceFrom" | "pricePromo"
    | "sku" | "unit" | "discountPct" | "savings" | "category" | "barcode" | "validity";
  shape?: "rect" | "square" | "circle" | "triangle" | "line";
  text?: string;
  style?: {
    color?: string; fill?: string;
    fontSize?: number; fontWeight?: string; align?: "left"|"center"|"right";
    outlineWidth?: number; outlineColor?: string; radius?: number; opacity?: number;
  };
};

type OfferBlock = {
  id: string; name: string;
  ratio: number;             // proporção do bloco
  elements: OfferElement[];
};
```

- `CatalogConfig` ganha `offerBlock?: OfferBlock` (o padrão ativo). Avaliar global vs.
  `PER_PAGE_KEYS`. Quando presente, **substitui** o bloco de preço padrão do card no render.
- `PriceStyle.shape/fill/outline* ` (construtor simples atual) viram o **elemento “Preço”**
  do `OfferBlock` — planejar migração.
- Persistência reutilizável: reusar `createTemplate` guardando `{ offerBlock }` (sem
  migration) OU novo model `PromotionalOfferBlock` (migration). Começar sem migration.

---

## Fases

1. **MVP — canvas + 3 variáveis + 2 formas.** Bloco editável na coluna do construtor;
   arrastar Preço/Nome/Foto e Retângulo/Círculo da paleta; drag/resize/rotate (reuso do
   `SelectionLayer`); render DOM ligado ao produto; “Salvar padrão” aplica ao catálogo
   (sem persistência org-level ainda). Valida a direção.
2. **Catálogo completo de variáveis + formas.** Todas as variáveis (menos ⚠️) +
   Triângulo/Quadrado/Linha/Texto fixo + propriedades por elemento (cor, contorno, raio,
   opacidade, fonte/tamanho/alinhamento, z-order).
3. **Padrão reutilizável org-level** (como os Padrões de catálogo) + miniatura; migração do
   `PriceStyleBuilder` simples para o elemento “Preço” do bloco livre.
4. **Variáveis que faltam dado.** Expor `ean` no `listProducts` + gerador de código de
   barras; definir semântica de “validade”.
5. **Refino.** Snap/guias, alinhar/distribuir múltiplos, travar/duplicar elemento, colar
   estilo; override por produto (opcional).

---

## Criterios de aceite (MVP — Fase 1)

- [ ] No construtor “Padrão de estilos de preços” há um **canvas** (bloco) editável.
- [ ] Paleta com **Variáveis** (Preço, Nome, Foto) e **Formas** (Retângulo, Círculo);
      arrastar da paleta cria o elemento no ponto solto.
- [ ] Cada elemento **move, redimensiona e gira** com alças (mesma pegada do `SelectionLayer`).
- [ ] As variáveis mostram o **dado real** do produto na *Prévia do card* e no export
      (`html-to-image`).
- [ ] “Salvar padrão” aplica o bloco a todos os produtos e persiste no `config` (autosave),
      sobrevivendo a reload.
- [ ] `pnpm biome check` + `npx tsc --noEmit` limpos; dev server no ar.

---

## Decisoes a tomar (antes de implementar)

- **DOM vs Konva.** Recomendado **DOM** (consistente com `renderCard` + export
  `html-to-image`).
- **Unidade de coordenada do elemento.** Fração 0–1 do bloco (escala com qualquer tamanho)
  vs px de referência. Fração é mais robusto.
- **Posição do bloco no card.** O `OfferBlock` ocupa a área do preço/oferta do card
  (substitui o bloco de preço) vs. um retângulo posicionável no card. Começar substituindo
  o bloco de preço.
- **Global vs por página vs por produto.** Alvo: **global**, aplicado a todos os produtos;
  override por produto é melhoria futura.
- **Persistência reutilizável.** Reusar `createTemplate` (sem migration) vs novo model
  (migration). Começar sem migration.

---

## Riscos / gotchas

- **Export `html-to-image`:** todo elemento precisa ser DOM e mesmo-origem (fotos via
  proxy, como hoje). SVG inline (triângulo/código de barras) precisa ser capturável.
- **Código de barras:** valor (EAN) não está no `CatalogProduct`; expor no `listProducts`
  + gerador (JsBarcode → SVG). Sem isso, a variável fica indisponível.
- **Coordenadas:** alinhar com o `SelectionLayer` para reusar as alças sem reescrever hit-test.
- **Multi-tenant:** ao persistir org-level, escopar por `organizationId` (CLAUDE.md).
- Este épico **substitui** o `PriceStyleBuilder` simples: o bloco de preço atual vira o
  elemento “Preço” do bloco livre — planejar migração dos padrões já salvos.

---

## Proximos passos

1. Aprovar **critérios de aceite** do MVP e as **decisões** (DOM vs Konva, unidade de
   coordenada, posição do bloco, persistência).
2. Abrir branch `feat/catalogo-precos-livre`.
3. Implementar Fase 1 (MVP) e validar a direção antes de seguir.

---

## Melhorias futuras (nao urgentes)

- [ ] Override do bloco por produto (um produto com layout próprio).
- [ ] Snap/guias inteligentes, alinhar/distribuir múltiplos, travar/duplicar elemento.
- [ ] Biblioteca de padrões de bloco compartilhada entre catálogos (org-level) com prévia.
- [ ] Efeitos (sombra, gradiente) por elemento; máscara de foto (círculo/rounded).
