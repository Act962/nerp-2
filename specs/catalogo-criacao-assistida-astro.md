# Catálogo promocional — criação assistida e gerador de ofertas com o Astro

> Menos passos para montar um catálogo por categoria, e uma oferta pronta em um clique: produtos + marca + estilo → a IA monta a página e cria o logo.
> Feature: `src/features/promotional-catalog` + `src/app/router/promotional-catalog` + `src/features/astro/server` + `src/app/(main)/(rest)/catalogo-promocional`
> Branch: `feat/catalogo-gerador-oferta-astro`
> Criado em: 2026-09-30 · Status: ✅ Fases 1–5 implementadas (aguardando teste do dev)

---

## Situacao atual

O editor já tem as peças difíceis: geração "1 página = 1 categoria" (`lib/apply-category.ts`),
páginas dinâmicas com textos vinculados (`binding`), overrides de preço por catálogo
(`priceOverrides`/`offerOverrides`), validade por página (`offerValidUntil`), três formatos
(`pageSize` square/story/portrait + `pageAspect`), biblioteca de logos (`CatalogAsset`) e
padrões (`toTemplateConfig`). O que falta é o caminho: montar um catálogo por categorias
exigiu ~40 passos na Finna Flor (30/09), e a única ação do Astro
(`tools/acoes-catalogo.ts` → `criarCatalogoPromocional`) cria o catálogo com `DEFAULT_CONFIG`
— sem estilo, cores, marca, logo, validade nem preço conferido. Geração de imagem hoje só existe
com Google (`gerar-imagem.ts`, `gemini-2.5-flash-image`), que está fora do ar (chave 403).

Arquivos principais:
- `src/features/promotional-catalog/types.ts` — `CatalogConfig` (:467), `CatalogPage` (:654), `TextElement` (:181), `Overlay` (:73), `makeDynamicTextElement` (:383), `toTemplateConfig` (:842)
- `src/features/promotional-catalog/components/catalog-editor.tsx` — editor; `duplicatePage` (:1660), aplicação por categoria (:1511)
- `src/features/promotional-catalog/components/config-panel.tsx` — painel da página; "Remover do catálogo" (:2721), upload de foto que grava no `Product` (:1024)
- `src/features/promotional-catalog/components/text-properties.tsx` — texto dinâmico (:74-135), tamanho ±4 (:217), cor nativa (:244), dimensão (:436)
- `src/features/promotional-catalog/lib/apply-category.ts` — paginação por categoria (copia só elementos com `binding`)
- `src/features/promotional-catalog/server/resolve-products.ts` — preços do cadastro
- `src/features/astro/server/{modelos.ts,gerar-imagem.ts,acoes/registro.ts,tools/acoes-catalogo.ts}` — modelos/preços, imagem, envelope de ação, ação atual
- `src/features/astro-consultor/server/provider.ts` — `resolverModelo`
- `src/features/stars/server/debitar.ts` + `lib/acoes-chaves.ts` — cobrança em ★
- `prisma/schema.prisma` — `PromotionalCatalog`, `PromotionalCatalogTemplate`, `CatalogAsset`, `AstroAcao`, `Brand`, `Organization.logo/primaryColor`

---

## Parte A — Criação assistida (menos passos, menos surpresa)

### Funcional
- [x] **A1. "Criar por categorias" em um passo** (`catalog-list.tsx`, `create.ts`) — em "Novo catálogo", opção
  "Por categorias": escolhe um catálogo/padrão como molde, as categorias, produtos por página e o formato;
  o sistema cria o catálogo com a capa do molde + páginas por categoria (reusa `applyCategory`).
  *Aceite*: da lista de catálogos ao catálogo pronto em ≤ 5 cliques; cada página nasce com
  `dynamic: category`, nome "<Categoria> N" e título mostrando a categoria.
- [x] **A2. "Tornar dinâmico" preservando o estilo** (`text-properties.tsx`) — no texto selecionado, ação
  "Vincular a → Nome da categoria/Nome da loja/…" que só acrescenta `binding` ao elemento existente
  (fonte, cor, caixa, posição ficam). Se a página não é dinâmica, o próprio fluxo liga e pede a entidade.
  *Aceite*: transformar o título "Arranjos Florais" em dinâmico = 2 cliques, sem mexer em estilo.
- [x] **A3. Aviso de texto fixo no "Por categoria"** (diálogo de adicionar produto) — antes de aplicar,
  listar textos/logos sem `binding` da página-molde que NÃO irão para as páginas novas, com
  "Tornar dinâmico" inline. *Aceite*: nunca gerar N páginas sem título sem avisar.
- [x] **A4. "Remover da página" ≠ "Remover do catálogo"** (`config-panel.tsx:2721`, `removeGroup` :1781) —
  o X padrão tira só da página atual (`productIds` dela); "Remover do catálogo" vira ação explícita no
  menu, com confirmação que diz em quantas páginas o produto está. Reusar `orphanedByPageDelete`
  (`lib/page-products.ts`). *Aceite*: produto em 2 páginas, remover de 1 → continua na outra.
- [x] **A5. Nome da página acompanha o vínculo** — ao ligar `dynamic` numa página, renomear para
  "<Entidade> N" se o nome ainda é o padrão ("Página N (cópia)…"); `duplicatePage` gera
  "<nome> 2", não "(cópia) (cópia)".
- [x] **A6. Alertas de dados antes de gerar** (diálogo "Por categoria" e gerador) — produtos com preço
  0, sem foto (usar `temFoto`/`conferirFotos` de `features/storefront/server/tem-foto.ts`), repetidos
  em mais de uma página. Ação: "revisar" (abre a lista filtrada) ou "seguir assim".

### UX
- [x] **A7. Seletor de cor único** — trocar os 14 `<input type="color">` nativos do feature por
  `ColorPickerField` (`components/color-picker-field.tsx`), com campo hexadecimal, conta-gotas e as
  cores da marca da organização como atalho. *Aceite*: digitar `#a44550` aplica; Tab não tira o foco
  do painel.
- [x] **A8. Controles numéricos digitáveis** — tamanho da fonte com campo editável (além de ±, passo 1
  com Shift = 4); dimensão L/A só aplica no blur/Enter (hoje `Number(v)||0` + clamp 20 pula valor ao
  apagar) — `text-properties.tsx:217-240,436-470`.
- [x] **A9. Caixa alta/baixa no texto dinâmico** — opção "Como cadastrado / Primeira maiúscula /
  MAIÚSCULAS" para nomes vindos do cadastro ("BOX" e "Arranjos florais" na mesma cara).

---

## Parte B — Gerador de oferta com o Astro

### Fluxo (assistente em 5 passos, painel lateral ou tela cheia)
1. **Formato** — "Escolha um formato": Encarte A4 (retrato) · Story 9:16 · Feed 4:5
   (`pageSize` portrait/story + `pageAspect` 0,8). Dentro de um catálogo aberto o formato é o dele
   (o formato é do catálogo, não da página) e o passo só confirma.
2. **Produtos** — busca, categorias e "em promoção" (reusa o diálogo de adicionar produto); tabela de
   conferência por produto: foto, nome, preço De (cadastro), preço Por (editável → vira
   `offerOverrides`), estoque, alerta de preço 0/sem foto (A6). Limite por formato (ex.: story ≤ 6).
3. **Oferta** — nome ("Rasga Outubro"), chamada opcional, validade (data/hora →
   `offerValidUntil`), informações extras (checkboxes prontos: "Enquanto durar o estoque",
   "Imagens ilustrativas", "Consulte condições"; + texto livre), contato (WhatsApp da loja).
4. **Marca e estilo** — marca: **Da empresa** (`Organization.logo` + cores da marca/`primaryColor`),
   **Marca cadastrada** (`Brand.logo`) ou **Upload**; logo da oferta: "Criar com IA" / "Usar o da
   marca" / "Sem logo". Estilo: climas prontos (Impacto varejo, Feira/hortifruti, Elegante,
   Minimalista, Datas especiais) + cor base; a paleta sai equilibrada pelo mesmo motor da vitrine
   (`gerarCombinacoes`/`destacarSobre`/`contraste` de `features/storefront/lib/cores.ts`).
5. **IA e gerar** — nível do modelo (Econômico / Equilibrado / Premium, padrão da organização),
   estimativa de ★ ("~12 ★: página 4 ★ + logo 8 ★") e saldo; botão **Gerar**. Resultado abre no
   editor comum.

### Como a IA monta (vocabulário fechado = qualidade + custo baixo)
- O modelo de texto NÃO desenha livre: recebe produtos, oferta, marca, formato e estilo e devolve,
  por `generateObject` (Vercel AI SDK + zod), um **`OfertaDesenhada`**: id do molde (de um conjunto
  curado por formato: "herói + grade 2×2", "grade 3×3", "destaque único", "lista com preços"…),
  paleta (validada pelo `contraste` ≥ 3:1 e corrigida por `destacarSobre`), título/chamada/selos
  ("-20%", "Só hoje"), estilo de etiqueta de preço (dos `PromotionalPriceStyle`/`cardLayout`
  existentes) e ordem dos produtos. ~2–4 mil tokens por página.
- Um **compositor determinístico** (`features/promotional-catalog/lib/compor-oferta.ts`, puro e
  testado) transforma o `OfertaDesenhada` em `CatalogPage[]`: posições dos textos e do logo vêm
  do molde, produtos paginados pelo limite do formato, `offerOverrides`, `offerValidUntil`,
  textos com `binding` quando fizer sentido. Molde e paleta inválidos caem no padrão, nunca quebram.
- **Logo da oferta**: modelo de imagem da OpenAI via `generateImage` (`@ai-sdk/openai`), PNG com
  fundo transparente, prompt montado do nome da oferta + estilo + cores + marca; salvo em
  `<orgId>/catalogo/logos/<uuid>.png` (`uploadBufferToR2`) e registrado em `CatalogAsset`, para
  reaparecer na biblioteca. "Gerar outro" cobra de novo; upload próprio sempre disponível.
- **Fundo por IA** (opcional, desligado por padrão): mesma via, só no Premium.

### Modelos e custo
| Nível | Texto (layout) | Imagem (logo) |
|---|---|---|
| Econômico | `gpt-4.1-nano` | `gpt-image-1-mini`, qualidade baixa |
| Equilibrado (padrão) | `gpt-4.1-mini` | `gpt-image-1-mini`, qualidade média |
| Premium | `gpt-4.1` | `gpt-image-1`, qualidade alta |

- Mesma família do Astro (`features/astro/server/modelos.ts`); a tabela `MODELOS` ganha preço
  por imagem (por qualidade/tamanho). Ids e preços conferidos na OpenAI na implementação — a
  tabela é o único lugar a mudar.
- ★ pelo custo real (`custoDaResposta`: US$ × dólar × margem ÷ R$/★) + chaves novas em
  `acoes-chaves.ts`: `astro_oferta_pagina`, `astro_oferta_logo`, `astro_oferta_fundo` (sobrepostas
  por `StarRule`). Estimativa antes (`podePagar`), débito só no sucesso (`cobrarValor`),
  `estornar` se a composição falhar depois de cobrar.
- Padrão por organização: coluna nova `Organization.aiOfferLevel` (enum `AiLevel`
  ECONOMICO/EQUILIBRADO/PREMIUM, default EQUILIBRADO), editável em Configurações e no passo 5.

### Execução e registro
- Tabela nova **`PromotionalOfferGeneration`** (orgId, userId, catalogId destino ou nulo, status
  PENDING/GENERATING/DONE/FAILED, `input` Json, nível, modelos usados, tokens, `starsEstimadas`,
  `starsCobradas`, `resultado` Json com ids de página/asset, `erro`). Migration aditiva.
- Padrão Inngest do projeto: a procedure `promotionalCatalog.offerGenerate` valida (org, permissão
  `catalogo-promocional-editar`, produtos da org, saldo), grava a linha GENERATING e envia
  `catalog/offer.generate`; a função `promo-offer-generate` é um `step.run` fino chamando
  `features/promotional-catalog/server/gerar-oferta.ts` (logo → layout → compor → gravar);
  `onFailure` marca FAILED e estorna; o cliente faz polling por `refetchInterval` no status.
- Auditoria também em `AstroAcao` (ferramenta `gerarOfertaComIA`), como as outras ações do Astro;
  tokens somados à `SiteChatSession` do app.
- Multi-tenancy: todo id de produto, marca, asset e catálogo reconferido por `organizationId`.

### Editar depois
- Preço: já é por catálogo (`offerOverrides`/`priceOverrides`) — sem mudança.
- **Imagem só neste catálogo** (novo): `CatalogConfig.imageOverrides: Record<productId, assetKey>`;
  "Trocar imagem" no painel passa a oferecer "Só neste catálogo" (padrão) vs "No cadastro do
  produto" (hoje é sempre no cadastro — `config-panel.tsx:1024`).
- Trocar/gerar outro logo, trocar paleta ("Refazer estilo" recompõe só visual, preservando
  preços, imagens e textos editados à mão).

### Astro na conversa
- Tool nova **`gerarPaginaDeOferta`** (com aprovação, `acoes/aprovacao.ts`) chamando o mesmo
  `gerar-oferta.ts`: "monta uma oferta Rasga Outubro com os cafés em promoção, story, válida até
  dia 31". O cartão de aprovação mostra formato, produtos, nível e ★ estimadas.
- `criarCatalogoPromocional` continua existindo para o caso simples.

---

## Pendencias (por fase)

### Fase 1 — Criação assistida (Parte A)
- [x] A1–A9 acima.

### Fase 2 — Assistente e compositor sem IA
- [x] Assistente em 5 passos com formato, produtos (conferência de preço), oferta, marca/estilo.
- [x] `compor-oferta.ts` + 3 moldes por formato + testes unitários (paginação, overrides, validade,
      paleta inválida cai no padrão). Já entrega oferta montada sem custo de IA (estilo escolhido
      pelo usuário).
- [x] Imagem só neste catálogo (`imageOverrides`).

### Fase 3 — Layout por IA, níveis e ★
- [x] `OfertaDesenhada` (zod) + `generateObject` por nível; `PromotionalOfferGeneration` + Inngest.
- [x] Níveis em `modelos.ts`, chaves ★, estimativa/débito/estorno; `Organization.aiOfferLevel` + tela.

### Fase 4 — Logo por IA
- [x] Provedor de imagem OpenAI (`generateImage` com `@ai-sdk/openai`), transparente, R2 + `CatalogAsset`;
      "Gerar outro"; cota diária por organização (mesma lógica de `gerar-imagem.ts`).
- [x] Fazer o `gerarImagem` do Astro também funcionar com OpenAI (hoje só Google, fora do ar).

### Fase 5 — Astro na conversa
- [x] Tool `gerarPaginaDeOferta` com aprovação; teste de integração no padrão de `astro-imagens.test.ts`.

---

## Decisoes tomadas
- **Resultado**: da lista → catálogo novo; dentro de um catálogo → páginas nele, no formato dele.
- **Formatos**: A4 retrato, Story 9:16, Feed 4:5 — já suportados por `pageSize`/`pageAspect`.
- **Modelo**: só OpenAI, 3 níveis com ★ estimadas; padrão por organização.
- **Marca**: da empresa, marca cadastrada ou upload; logo da oferta por IA opcional.
- **Vocabulário fechado**: a IA escolhe entre moldes e parâmetros; um compositor puro desenha.
  Motivo: resultado sempre legível e dentro do padrão visual, custo baixo e testável sem modelo.
- **Resultado é um catálogo comum**: tudo que a IA fez é editável no editor atual.

## Proximos passos
1. Fase 1 (A4 "remover da página" e A7 seletor de cor primeiro — maior dor, menor risco).
2. Fase 2 (entrega o assistente sem custo de IA).
3. Fases 3 → 4 → 5.

## Melhorias futuras (nao urgentes)
- [ ] Carrossel: várias páginas de story geradas de uma vez com sequência.
- [ ] Agendar publicação no WhatsApp/Instagram direto do resultado.
- [ ] Aprender o estilo preferido da organização (padrão sugerido com base nas gerações aceitas).

## Verificacao (por fase)
- Unit: `apply-category`, `compor-oferta` (moldes × formatos), remoção por página, estimativa de ★.
- Integração (`tests/integration`, duas orgs): `offerGenerate` recusa produto/marca/catálogo de outra
  org; sem saldo não gera; falha do provedor (dublado) não cobra; sucesso cobra e grava
  `PromotionalOfferGeneration` + `AstroAcao`.
- Navegador: criar "Rasga Outubro" nos 3 formatos, trocar preço e imagem só no catálogo, gerar outro
  logo, e montar um catálogo por categorias em ≤ 5 cliques.
