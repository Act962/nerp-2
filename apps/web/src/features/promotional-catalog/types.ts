// Estilo de exibição do preço no card. `accent` é a cor da borda (boxed) ou do
// fundo (highlight); `text` a cor do texto do preço nessas variantes.
export type PriceStyle = {
  variant: "plain" | "boxed" | "highlight";
  accent: string;
  text: string;
  // Multiplicador do tamanho do preço (1 = padrão). "Aumentar texto".
  size?: number;
  // Alinhamento dos textos do card (nome + preço).
  align?: "left" | "center" | "right";
  // Estilo dos preços secundários no card. "De" = preço normal riscado;
  // "savings" = "Economize R$…". Cor undefined = aparência padrão do card.
  deColor?: string;
  deSize?: number;
  savingsColor?: string;
  savingsSize?: number;
  // Remove o contorno (borda) do box de preço nas variantes com borda.
  hideBorder?: boolean;
  // ── "Padrão de estilos de preços" (construtor simples) ──────────────────
  // Forma do bloco de preço: nenhum (só texto), retângulo, arredondado, selo
  // (círculo) ou serrilhado (borda recortada estilo carimbo/etiqueta).
  shape?: "none" | "rect" | "rounded" | "seal" | "serrated";
  // Cor de preenchimento do bloco (quando a forma tem fundo).
  fill?: string;
  // Espessura do contorno do bloco (px). 0/ausente = sem contorno.
  outlineWidth?: number;
  // Cor do contorno do bloco.
  outlineColor?: string;
};

// Ajustes da imagem do produto no card: margem, padding por lado (px) e contorno.
export type ImageBoxStyle = {
  margin: number;
  padding: { top: number; right: number; bottom: number; left: number };
  hideBorder: boolean;
  hideShadow: boolean;
  hideBackground: boolean;
};

// Redimensionamento e corte NÃO-destrutivos da foto por produto (só exibição no
// card): `scale` amplia (corta ao ampliar), `posX/posY` escolhem a parte visível
// (0–100%), `fit` = preencher (cover) ou caber inteiro (contain).
export type ImageAdjustment = {
  scale: number;
  posX: number;
  posY: number;
  fit: "cover" | "contain";
};

export const DEFAULT_IMAGE_ADJUSTMENT: ImageAdjustment = {
  scale: 1,
  posX: 50,
  posY: 50,
  fit: "cover",
};

// Etiqueta posicionada livremente sobre o catálogo (canvas). Coordenadas em px
// no canvas de 1080 × pageH (mesmo espaço do preview), então independem do zoom.
export type Overlay = {
  id: string;
  assetKey: string; // chave R2 do PNG (vazio quando `shape` está presente)
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number; // graus
  // FORMA vetorial (aba "Elementos", estilo Canva). Quando presente, o overlay
  // é desenhado como forma (não imagem). `fill` = cor de preenchimento.
  shape?:
    | "rect"
    | "rounded"
    | "circle"
    | "line"
    | "triangle"
    | "star"
    | "frame";
  fill?: string;
  // Propriedades de estilo (Fase 4). Ausentes = padrão (sem efeito).
  opacity?: number; // 0-100 (%); default 100
  radius?: number; // arredondamento de canto em px; default 0
  borderWidth?: number; // contorno em px; default 0
  borderColor?: string; // cor do contorno; default #000000
  flipH?: boolean; // inverter horizontal
  flipV?: boolean; // inverter vertical
  // Etiqueta DINÂMICA: quando presente, a imagem resolve de uma entidade da
  // página dinâmica (loja/org/produto/usuário) no render; `assetKey` fica como
  // placeholder/fallback. Ver `lib/resolve-entity.ts`.
  binding?: ImageBinding;
  // Redimensionador/enquadramento da imagem (Caber/Cobrir + zoom + posição) —
  // mesmo padrão do sistema (`ImageAdjustment`). Ausente = "Caber" (contain).
  adjust?: ImageAdjustment;
};

// Seleção de camada no editor estilo Canva. Uma camada selecionada por vez:
// Fundo, Grupo de produtos (pai), Card de um produto (filho), um Elemento
// (etiqueta), um Texto ou um Bloco de estilo. `null` = nada selecionado.
export type LayerSelection =
  | { kind: "background" }
  | { kind: "group"; id?: string }
  | { kind: "card"; id: string }
  | { kind: "element"; id: string }
  | { kind: "text"; id: string }
  | { kind: "styleBlock"; id: string }
  | null;

// Retângulo em px no canvas 1080×pageH (mesmo espaço dos overlays).
export type LayerRect = { x: number; y: number; w: number; h: number };

// Grupo de produtos (modo multi-grupo). Cada grupo é uma grade posicionável de
// `gridCols × gridRows` cards, com seu retângulo próprio (px no canvas). Os
// produtos da página são distribuídos sequencialmente entre os grupos (grupo 1
// = primeiros cols×linhas, grupo 2 = próximos, etc.; o último leva o restante).
// Ausente na página = modo grupo-único (usa `productGroup` + fluxo padrão).
export type ProductGroup = {
  id: string;
  rect: LayerRect;
  gridCols: number;
  gridRows: number;
  // Grupo NOMEADO com produtos próprios (ex.: por categoria). Quando `productIds`
  // está definido, o grupo mostra ESSES produtos (na sua região); sem ele, é uma
  // região de capacidade que os produtos "fluem" (comportamento antigo).
  name?: string;
  productIds?: string[];
  // Cor de fundo da região do grupo (undefined = transparente). `gridCols`/
  // `gridRows` são a "Disposição" (colunas × linhas) do grupo.
  bgColor?: string;
  bgOpacity?: number; // 0..100 (%) — transparência do fundo (default 100).
  radius?: number; // px — arredondamento dos cantos da região.
  borderColor?: string;
  borderWidth?: number; // px — contorno da região (0 = sem contorno).
};

// Bloco de estilo individual: um card livre (desenho de `cardLayout`) colocado
// como elemento posicionável na página, ligado a UM produto (resolve as
// variáveis daquele produto). Coordenadas em px no canvas 1080×pageH — o mesmo
// espaço das etiquetas/textos, então reusa a mesma pegada de mover/redimensionar.
export type StyleBlock = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number; // graus
  productId: string; // produto cujas variáveis o bloco resolve
  cardLayout: CardLayoutElement[]; // desenho do card (de um estilo salvo)
  opacity?: number; // 0-100 (%); default 100
};

// Bloco de texto livre sobre o catálogo (canvas). Coordenadas em px no canvas
// 1080×pageH (mesmo espaço das etiquetas), então independem do zoom.
export type TextElement = {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number; // graus
  fontFamily: string;
  fontSize: number; // px no canvas
  color: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  uppercase?: boolean;
  align?: "left" | "center" | "right";
  opacity?: number; // 0-100 (%); default 100
  list?: boolean; // lista com marcadores (bullets)
  letterSpacing?: number; // px entre letras; default 0
  lineHeight?: number; // multiplicador da altura de linha; default 1.15
  anchor?: "top" | "middle" | "bottom"; // ancoragem vertical na caixa
  // Caixa (borda/fundo) ao redor do texto — igual ao "Texto" do Montar card.
  boxed?: boolean;
  boxFill?: string; // cor de fundo da caixa
  boxBorderColor?: string; // cor do contorno
  boxBorderWidth?: number; // espessura do contorno (px); 0 = sem
  boxRadius?: number; // arredondamento dos cantos (px)
  // Texto DINÂMICO: quando presente, o conteúdo resolve de uma entidade da
  // página dinâmica no render; `text` fica como placeholder/fallback.
  binding?: TextBinding;
};

// Fontes disponíveis no editor (Fase A — fontes web-safe; banco de tipografias
// Google Fonts fica para depois).
export const TEXT_FONTS: { value: string; label: string }[] = [
  { value: "Inter, sans-serif", label: "Inter" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "'Helvetica Neue', Helvetica, sans-serif", label: "Helvetica" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', Times, serif", label: "Times" },
  { value: "'Courier New', monospace", label: "Courier" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: "Tahoma, sans-serif", label: "Tahoma" },
  { value: "'Trebuchet MS', sans-serif", label: "Trebuchet" },
  {
    value: "'Lucida Sans Unicode', 'Lucida Grande', sans-serif",
    label: "Lucida",
  },
  {
    value: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
    label: "Palatino",
  },
  { value: "Garamond, serif", label: "Garamond" },
  { value: "Impact, sans-serif", label: "Impact" },
  { value: "'Arial Black', sans-serif", label: "Arial Black" },
  { value: "'Comic Sans MS', cursive", label: "Comic Sans" },
  { value: "'Brush Script MT', cursive", label: "Brush Script" },
];

export function makeTextElement(): TextElement {
  return {
    id: crypto.randomUUID(),
    text: "Novo texto",
    x: 340,
    y: 460,
    w: 400,
    h: 120,
    rotation: 0,
    fontFamily: "Inter, sans-serif",
    fontSize: 64,
    color: "#111111",
    align: "center",
  };
}

// ── Card livre (editor de variáveis + formas) ──────────────────────────────
// Variáveis que resolvem um dado do produto no render.
export type CardVariable =
  | "name"
  | "priceActive"
  | "priceReais"
  | "priceCents"
  | "priceCurrency"
  | "priceFrom"
  | "photo"
  | "unit"
  | "sku"
  | "savings"
  | "discountPct"
  | "category";

export const CARD_VARIABLES: { value: CardVariable; label: string }[] = [
  { value: "photo", label: "Foto" },
  { value: "name", label: "Nome" },
  { value: "priceActive", label: "Preço" },
  { value: "priceCurrency", label: "R$" },
  { value: "priceReais", label: "Preço (reais)" },
  { value: "priceCents", label: "Preço (centavos)" },
  { value: "priceFrom", label: "Preço (De)" },
  { value: "unit", label: "Unidade" },
  { value: "sku", label: "SKU" },
  { value: "discountPct", label: "% desconto" },
  { value: "savings", label: "Economize" },
  { value: "category", label: "Categoria" },
];

// ── Página dinâmica (vínculo com entidade) ─────────────────────────────────
// Uma página pode ser marcada como DINÂMICA e vinculada a UMA entidade. Os
// textos/etiquetas com `binding` resolvem os dados dessa entidade no render
// (editor, export e link público). Ver `lib/resolve-entity.ts`.
export type EntitySource = "store" | "org" | "product" | "user";

// Variáveis de TEXTO por entidade (resolvem uma string).
export type EntityTextVar =
  | "store.name"
  | "store.code"
  | "store.city"
  | "store.state"
  | "org.name"
  | "org.tradeName"
  | "org.sigla"
  | "org.city"
  | "org.state"
  | "product.name"
  | "product.sku"
  | "product.priceActive"
  | "product.unit"
  | "user.name"
  | "user.email"
  | "user.whatsapp";

// Variáveis de IMAGEM por entidade (resolvem uma chave R2 ou URL absoluta).
export type EntityImageVar =
  | "store.coverImage" // Store.coverImageKey (foto da fachada)
  | "org.logo" // Organization.logo
  | "product.thumbnail" // Product.thumbnail
  | "user.image"; // User.image (URL)

export type TextBinding = { source: EntitySource; variable: EntityTextVar };
export type ImageBinding = { source: EntitySource; variable: EntityImageVar };

// Rótulos das variáveis de texto, agrupados por entidade (para os pickers da UI).
export const ENTITY_TEXT_VARS: Record<
  EntitySource,
  { value: EntityTextVar; label: string }[]
> = {
  store: [
    { value: "store.name", label: "Nome da loja" },
    { value: "store.code", label: "Código da loja" },
    { value: "store.city", label: "Cidade da loja" },
    { value: "store.state", label: "UF da loja" },
  ],
  org: [
    { value: "org.name", label: "Nome da organização" },
    { value: "org.tradeName", label: "Nome fantasia" },
    { value: "org.sigla", label: "Sigla" },
    { value: "org.city", label: "Cidade da org" },
    { value: "org.state", label: "UF da org" },
  ],
  product: [
    { value: "product.name", label: "Nome do produto" },
    { value: "product.sku", label: "SKU" },
    { value: "product.priceActive", label: "Preço" },
    { value: "product.unit", label: "Unidade" },
  ],
  user: [
    { value: "user.name", label: "Nome do usuário" },
    { value: "user.email", label: "E-mail" },
    { value: "user.whatsapp", label: "WhatsApp" },
  ],
};

// Rótulos das variáveis de imagem, agrupados por entidade.
export const ENTITY_IMAGE_VARS: Record<
  EntitySource,
  { value: EntityImageVar; label: string }[]
> = {
  store: [{ value: "store.coverImage", label: "Foto da loja" }],
  org: [{ value: "org.logo", label: "Logo da organização" }],
  product: [{ value: "product.thumbnail", label: "Foto do produto" }],
  user: [{ value: "user.image", label: "Foto do usuário" }],
};

// Rótulo legível de uma variável (para "Vinculado a: …" e placeholders).
export function entityVarLabel(binding: TextBinding | ImageBinding): string {
  const textHit = ENTITY_TEXT_VARS[binding.source]?.find(
    (v) => v.value === binding.variable,
  );
  if (textHit) return textHit.label;
  const imgHit = ENTITY_IMAGE_VARS[binding.source]?.find(
    (v) => v.value === binding.variable,
  );
  return imgHit?.label ?? binding.variable;
}

// Texto dinâmico: nasce com o rótulo como placeholder (visível antes de
// resolver) e o `binding` setado.
export function makeDynamicTextElement(binding: TextBinding): TextElement {
  return { ...makeTextElement(), text: entityVarLabel(binding), binding };
}

// Etiqueta dinâmica (imagem): caixa padrão + `binding`. `assetKey` vazio =
// placeholder resolvido no render.
export function makeDynamicOverlay(binding: ImageBinding): Overlay {
  return {
    id: crypto.randomUUID(),
    assetKey: "",
    x: 420,
    y: 360,
    w: 240,
    h: 240,
    rotation: 0,
    binding,
  };
}

// Elemento do card livre. Geometria em fração 0..1 do card (escala com qualquer
// tamanho). `fontFrac` = tamanho da fonte como fração da altura do card.
export type CardLayoutElement = {
  id: string;
  kind: "var" | "shape" | "text";
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  z?: number;
  variable?: CardVariable;
  shape?: "rect" | "circle";
  // Texto fixo (kind "text"): conteúdo digitado (ex.: "UND", "cada", "OFERTA").
  text?: string;
  color?: string;
  fill?: string;
  fontFrac?: number;
  fontWeight?: number;
  // Tipografia (família da fonte). Ausente = Inter (padrão). Valores em TEXT_FONTS.
  fontFamily?: string;
  align?: "left" | "center" | "right";
  // Raio dos cantos como FRAÇÃO da altura do card (px uniforme; não distorce
  // ao esticar). Vale para formas e para a caixa de texto.
  radius?: number;
  opacity?: number;
  // Caixa do texto (kind "text"/variável): fundo + borda ao redor do texto.
  boxed?: boolean;
  // Espessura do contorno como fração da altura do card.
  outlineWidth?: number;
  outlineColor?: string;
};

export function makeCardElement(
  partial: Partial<CardLayoutElement> & Pick<CardLayoutElement, "kind">,
): CardLayoutElement {
  return {
    id: crypto.randomUUID(),
    x: 0.1,
    y: 0.1,
    w: 0.4,
    h: 0.15,
    rotation: 0,
    z: 0,
    color: "#111111",
    fill: "#dc2626",
    fontFrac: 0.09,
    fontWeight: 700,
    align: "left",
    opacity: 1,
    ...partial,
  };
}

export const DEFAULT_PRICE_STYLE: PriceStyle = {
  variant: "plain",
  accent: "#dc2626",
  text: "#ffffff",
  size: 1,
  align: "left",
};

export type CatalogConfig = {
  title: string;
  subtitle: string;
  // Liga/desliga a exibição de cada elemento de identidade (default: ligado).
  showTitle: boolean;
  showSubtitle: boolean;
  pageSize: "square" | "story" | "portrait";
  // Proporção (largura/altura) EXATA da página. Quando definida, sobrepõe o
  // preset de `pageSize` — usada ao enviar um fundo p/ a página assumir a forma
  // exata da imagem (o "Cobrir tudo" preenche sem cortar). Escolher um preset de
  // tamanho limpa este campo.
  pageAspect?: number;
  layout:
    | "grid-2"
    | "grid-3"
    | "grid-4"
    | "list"
    | "featured"
    | "carousel"
    | "masonry"
    | "table"
    | "custom";
  // Disposição personalizada (layout "custom"): grade de colunas × linhas.
  // itens por página = gridCols × gridRows.
  gridCols: number;
  gridRows: number;
  // Centraliza a ÚLTIMA linha incompleta da grade (ex.: 8 produtos em 3 colunas
  // → os 2 últimos centralizados). Ausente = ligado. false = alinha à esquerda.
  centerLastRow?: boolean;
  // Retângulo do Grupo de produtos (Fase 5, estilo Canva). Quando definido, a
  // grade é posicionada absolutamente nessas coords (mover/redimensionar o grupo
  // → os cards se ajustam). Ausente = fluxo padrão (ocupa a área de conteúdo).
  productGroup?: LayerRect;
  // Múltiplos grupos de produtos (por página). Quando presente (≥1), a página
  // entra no modo multi-grupo: cada grupo é uma grade posicionável com sua fatia
  // de produtos. Ausente = grupo único (usa `productGroup` + fluxo padrão).
  productGroups?: ProductGroup[];
  // Escala proporcional do Grupo (modo "proporção" do redimensionamento): quando
  // ≠ 1, TODOS os elementos do grupo (cards e textos) aumentam/diminuem juntos
  // via transform. Default 1 (redimensionamento dinâmico, sem escala).
  productGroupScale?: number;
  cardStyle:
    | "compact"
    | "standard"
    | "list"
    | "countdown"
    | "badge-hot"
    | "minimal";
  sortBy:
    | "discount-desc"
    | "price-asc"
    | "price-desc"
    | "name-asc"
    | "savings-desc";
  backgroundColor: string;
  // Degradê do fundo (por página). Quando definido, substitui a cor sólida.
  backgroundGradient?: { from: string; to: string; angle: number };
  // Transparência do fundo (0-100%). Default 100 (opaco).
  backgroundOpacity?: number;
  cardColor: string;
  // Proporção (largura/altura) do card do "Montar card". Default (undefined) =
  // 1 (quadrado). < 1 = card mais ALTO; > 1 = mais baixo/largo.
  cardAspectRatio?: number;
  // Fundo do card transparente (ignora `cardColor`). Default (undefined) = opaco.
  hideCardBackground?: boolean;
  // Contorno do card: espessura (px) e cor. 0/ausente = sem contorno.
  cardBorderWidth?: number;
  cardBorderColor?: string;
  // Cor do fundo atrás da FOTO do produto no card. Ausente = usa `cardColor`.
  imageBackgroundColor?: string;
  textSize: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  fontWeight: "normal" | "medium" | "semibold" | "bold";
  backgroundImage: string;
  backgroundFit: "cover" | "contain";
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  // Imagem do produto: margem (px), padding por lado (px) e remover contorno.
  imageMargin: number;
  imagePaddingTop: number;
  imagePaddingRight: number;
  imagePaddingBottom: number;
  imagePaddingLeft: number;
  hideImageBorder: boolean;
  // Remover a sombra do card e a cor de fundo (cinza) atrás da imagem.
  hideImageShadow: boolean;
  hideImageBackground: boolean;
  // Remover contorno do box de preço (variantes com borda).
  hidePriceBorder: boolean;
  // Redimensionamento/corte da foto por produto (productId → ajuste). Só exibição.
  imageAdjustments: Record<string, ImageAdjustment>;
  // Etiquetas (PNGs) posicionadas livremente sobre o catálogo.
  overlays: Overlay[];
  // Blocos de texto livres sobre o catálogo (ferramenta "Texto").
  texts?: TextElement[];
  // Elementos DINÂMICOS (com binding: logo da loja, nome do cliente…) guardados
  // no PADRÃO — reaplicados em toda página nova ao gerar. Só existe em configs de
  // padrão/template; catálogos comuns não usam.
  templateDynamic?: { overlays: Overlay[]; texts: TextElement[] };
  // Blocos de estilo individuais (cards livres posicionáveis ligados a um
  // produto), além do(s) grupo(s) de produtos. Por página.
  styleBlocks?: StyleBlock[];
  // Vínculo dinâmico da PÁGINA (per-page; ver `CatalogPage.dynamic`). Só existe
  // no config efetivo de uma página; ausente no global.
  dynamic?: CatalogPage["dynamic"];
  showDescription: boolean;
  showCategory: boolean;
  showStock: boolean;
  showSku: boolean;
  // Mostra a unidade (kg/un/cx…) ao lado do preço no card.
  showUnit: boolean;
  excludedProductIds: string[];
  manuallyAddedIds: string[];
  categoryFilter: string[];
  // Inclui automaticamente TODOS os produtos em promoção ativa. Default false —
  // o catálogo começa vazio e o usuário adiciona produtos (manual/categoria).
  autoPromotions?: boolean;
  // Ordem manual dos produtos (productId[]). Quando preenchida, tem prioridade
  // sobre `sortBy`: os ids listados vêm primeiro nessa sequência; os demais
  // seguem no fim pela ordenação automática. Vazio = só `sortBy`.
  productOrder?: string[];
  // Preço normal sobrescrito SÓ para exibição neste catálogo (productId → valor).
  // Não altera o produto no banco — o card e o desconto seguem este valor.
  priceOverrides: Record<string, number>;
  // Preço de OFERTA ("Por") por-catálogo (productId → valor). Espelha o
  // `priceOverrides` (que é o "De"), mas para o preço em destaque. Catálogo-
  // scoped: NÃO altera o `promotionalPrice` do cadastro/ERP. Tem prioridade
  // sobre o `promotionalPrice` do produto na resolução do preço ativo.
  offerOverrides?: Record<string, number>;
  // Estilo padrão do preço (aplica a todos) + override por produto.
  priceStyle: PriceStyle;
  priceStyleOverrides: Record<string, PriceStyle>;
  // Card livre (editor de variáveis + formas). Quando tem elementos, o card é
  // desenhado livremente com estes elementos (posições em fração 0..1 do card),
  // substituindo o template de `cardStyle`. Padrão GLOBAL (todas as páginas).
  cardLayout?: CardLayoutElement[];
  // Override do card livre POR PRODUTO (productId → desenho). Tem prioridade
  // sobre o card da página e o global. "Salvar apenas para esse produto".
  cardLayoutOverrides?: Record<string, CardLayoutElement[]>;
  footerText: string;
  footerTextSize: CatalogConfig["textSize"];
  footerSupplierIds: string[];
  // Liga/desliga o rodapé de texto e os logos de fornecedores (default: ligado).
  showFooter: boolean;
  showFooterSuppliers: boolean;
  // Validade da oferta (ISO datetime local, ex.: "2026-08-31T23:59"). Vencida =
  // catálogo não pode ser compartilhado e mostra "Oferta vencida" no preview.
  offerValidUntil?: string;
  // Marca d'água Órbita no canto inferior (auto-detecta o canto livre).
  // Default (undefined) = ligada. false = desligada.
  watermark?: boolean;
  // Lista importada (aba "Lista"): planilha/PDF/imagem → catálogo. Fonte editável
  // de onde "Gerar" reconstrói as páginas (uma por cliente). Produtos virtuais.
  list?: CatalogList;
  // Páginas do catálogo (estilo Canva). Cada uma tem Disposição, Fundo e
  // Etiquetas próprios. Vazio = catálogo antigo (migra para 1 página no load).
  pages: CatalogPage[];
};

// Etiqueta EFETIVA de um produto: override por produto → global → vazio.
export function effectiveCardLayout(
  config: Pick<CatalogConfig, "cardLayout" | "cardLayoutOverrides">,
  productId: string,
): CardLayoutElement[] {
  return config.cardLayoutOverrides?.[productId] ?? config.cardLayout ?? [];
}

// A etiqueta mostra um ÚNICO preço (sem a variável "De"/riscada `priceFrom`)?
// Quando a etiqueta é a padrão (sem elementos desenhados), o card padrão só
// exibe o "De" riscado quando há promoção — então `hasTwoPrices` decide.
export function cardShowsSinglePrice(
  layout: CardLayoutElement[],
  hasTwoPrices: boolean,
): boolean {
  if (layout.length > 0)
    return !layout.some((e) => e.kind === "var" && e.variable === "priceFrom");
  return !hasTwoPrices;
}

// Página independente do catálogo. `layout`/fundo/`overlays` sobrescrevem o
// global só nesta página. Os produtos ainda fluem automaticamente (Fase 1).
export type CatalogPage = {
  id: string;
  name: string;
  locked: boolean;
  layout: CatalogConfig["layout"];
  gridCols: number;
  gridRows: number;
  centerLastRow?: boolean;
  productGroup?: LayerRect;
  productGroups?: ProductGroup[];
  productGroupScale?: number;
  backgroundColor: string;
  backgroundGradient?: { from: string; to: string; angle: number };
  backgroundOpacity?: number;
  backgroundImage: string;
  backgroundFit: CatalogConfig["backgroundFit"];
  overlays: Overlay[];
  texts?: TextElement[];
  styleBlocks?: StyleBlock[];
  // Override do card livre para ESTA página (todos os produtos da página).
  // "Alterar apenas para essa página". Ausente = usa o card global.
  cardLayout?: CardLayoutElement[];
  // Atribuição EXPLÍCITA de produtos à página (ids). Ausente = a página entra no
  // fluxo automático (distribuição sequencial por capacidade). Quando ao menos
  // uma página tem `productIds`, o catálogo fixa os produtos por página — assim
  // inserir/remover páginas não redistribui os produtos das outras.
  productIds?: string[];
  // Página DINÂMICA (opt-in): vincula a página a UMA entidade. Os textos/
  // etiquetas com `binding` resolvem os dados dessa entidade no render.
  // `org` é implícita (org do catálogo, sem refId); `store` com `auto:true`
  // casa pelo nome da página; `product`/`user` usam `refId`.
  dynamic?: {
    type: EntitySource;
    refId?: string;
    auto?: boolean;
  };
  // Validade da oferta DESTA página (ISO datetime-local). Após a data, a página
  // é ocultada no link público. Cada página tem seu próprio prazo.
  offerValidUntil?: string;
};

// Campos de aparência que passam a ser POR PÁGINA (sobrescrevem o global na
// página selecionada). O resto da config continua global.
export const PER_PAGE_KEYS = [
  "layout",
  "gridCols",
  "gridRows",
  "centerLastRow",
  "productGroup",
  "productGroups",
  "productGroupScale",
  "backgroundColor",
  "backgroundGradient",
  "backgroundOpacity",
  "backgroundImage",
  "backgroundFit",
  "overlays",
  "texts",
  "styleBlocks",
  "dynamic",
  "offerValidUntil",
] as const;

// Deriva a página 1 a partir dos campos globais (migração de catálogos antigos).
export function firstPageFromConfig(config: CatalogConfig): CatalogPage {
  return {
    id: "page-1",
    name: "Página 1",
    locked: false,
    layout: config.layout,
    gridCols: config.gridCols ?? 3,
    gridRows: config.gridRows ?? 4,
    productGroup: config.productGroup,
    productGroups: config.productGroups,
    productGroupScale: config.productGroupScale,
    backgroundColor: config.backgroundColor,
    backgroundGradient: config.backgroundGradient,
    backgroundOpacity: config.backgroundOpacity,
    backgroundImage: config.backgroundImage,
    backgroundFit: config.backgroundFit,
    overlays: config.overlays ?? [],
    texts: config.texts ?? [],
    styleBlocks: config.styleBlocks ?? [],
    offerValidUntil: config.offerValidUntil,
  };
}

// Garante ao menos 1 página (migra no load quando `pages` está vazio).
export function ensurePages(config: CatalogConfig): CatalogPage[] {
  return config.pages && config.pages.length > 0
    ? config.pages
    : [firstPageFromConfig(config)];
}

// A oferta está vencida? (validade definida e já passou.)
export function isOfferExpired(
  config: { offerValidUntil?: string },
  now: Date = new Date(),
): boolean {
  if (!config.offerValidUntil) return false;
  const until = new Date(config.offerValidUntil);
  if (Number.isNaN(until.getTime())) return false;
  return now.getTime() > until.getTime();
}

// Campos específicos de produto — NÃO entram num padrão (preset de estilo).
// Ao aplicar um padrão, esses campos do catálogo atual são preservados.
const TEMPLATE_OMIT_KEYS = [
  "excludedProductIds",
  "manuallyAddedIds",
  "categoryFilter",
  "priceOverrides",
  "offerOverrides",
  "priceStyleOverrides",
  "imageAdjustments",
  "productOrder",
  "overlays",
  "texts",
  "styleBlocks",
  "list",
  "pages",
] as const;
// Nota: o padrão GUARDA a posição da grade (gridCols/gridRows/productGroup(s)/
// productGroupScale), o redimensionamento do card (cardAspectRatio + cardLayout
// + cardLayoutOverrides) e o fundo. Só ficam de fora os dados por produto de
// preço/foto, as etiquetas/textos por página e a própria lista/páginas.

// Extrai só a aparência do catálogo para salvar como padrão.
// Categorias de "Padrões do Sistema" — cada uma recorta uma fatia da aparência.
export type TemplateKind = "background" | "group" | "label";
const TEMPLATE_KIND_KEEP: Record<TemplateKind, string[]> = {
  background: [
    "backgroundColor",
    "backgroundGradient",
    "backgroundOpacity",
    "backgroundImage",
    "backgroundFit",
    "watermark",
  ],
  group: [
    "layout",
    "gridCols",
    "gridRows",
    "productGroup",
    "productGroups",
    "productGroupScale",
  ],
  label: [
    "cardStyle",
    "cardLayout",
    "cardLayoutOverrides",
    "cardAspectRatio",
    "hideCardBackground",
    "cardColor",
    "priceStyle",
    "templateDynamic",
  ],
};

export function toTemplateConfig(
  config: CatalogConfig,
  kind?: TemplateKind,
): Record<string, unknown> {
  // Elementos DINÂMICOS (com binding: logo da loja, nome do cliente…) da página
  // atual — guardados para reaplicar. Estáticos ficam de fora (é conteúdo).
  const dynOverlays = (config.overlays ?? []).filter((o) => o.binding);
  const dynTexts = (config.texts ?? []).filter((t) => t.binding);
  const templateDynamic =
    dynOverlays.length > 0 || dynTexts.length > 0
      ? { overlays: dynOverlays, texts: dynTexts }
      : undefined;

  // A ETIQUETA (cardLayout) pode ter sido montada POR PÁGINA (pages[].cardLayout)
  // em vez de global. Como o padrão não guarda `pages`, capturamos a 1ª página
  // com etiqueta para o padrão nascer COMPLETO — senão "Começar de um padrão"
  // traz o fundo mas não a etiqueta.
  const cardLayout =
    config.cardLayout ??
    (config.pages ?? []).find(
      (p) => Array.isArray(p.cardLayout) && p.cardLayout.length > 0,
    )?.cardLayout;

  // Padrão POR CATEGORIA (sistema): só as chaves daquela fatia.
  if (kind) {
    const src: Record<string, unknown> = { ...config, cardLayout, templateDynamic };
    const slice: Record<string, unknown> = { templateKind: kind };
    for (const key of TEMPLATE_KIND_KEEP[kind])
      if (src[key] !== undefined) slice[key] = src[key];
    // Grupo = REGIÕES da grade, sem produtos específicos.
    if (kind === "group" && Array.isArray(slice.productGroups))
      slice.productGroups = (slice.productGroups as ProductGroup[]).map(
        ({ productIds, ...g }) => g,
      );
    return slice;
  }

  // Padrão COMPLETO (aparência do catálogo, org).
  const clone: Record<string, unknown> = { ...config, cardLayout };
  for (const key of TEMPLATE_OMIT_KEYS) delete clone[key];
  if (templateDynamic) clone.templateDynamic = templateDynamic;
  else delete clone.templateDynamic;
  return clone;
}

// Aplica uma FATIA de padrão (categoria) sobre o config atual — só as chaves da
// categoria, sem tocar em produtos/preços/lista.
export function applyTemplateSlice(
  slice: Record<string, unknown>,
): Partial<CatalogConfig> {
  const kind = slice.templateKind as TemplateKind | undefined;
  const keys = kind ? TEMPLATE_KIND_KEEP[kind] : [];
  const patch: Record<string, unknown> = {};
  for (const key of keys) if (slice[key] !== undefined) patch[key] = slice[key];
  return patch as Partial<CatalogConfig>;
}

export const TEXT_SIZE_CSS: Record<CatalogConfig["textSize"], string> = {
  xs: "0.75rem", // 12px
  sm: "1rem", // 16px
  base: "1.375rem", // 22px
  lg: "1.875rem", // 30px
  xl: "2.5rem", // 40px
  "2xl": "3.25rem", // 52px
  "3xl": "4rem", // 64px
  "4xl": "5rem", // 80px
};

export const FONT_WEIGHT_CSS: Record<CatalogConfig["fontWeight"], string> = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
};

export type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  thumbnail: string;
  salePrice: number;
  // Unidade de venda do cadastro (ProductUnit: UN/KG/CX/L/ML…).
  unit: string;
  // Preço do cadastro (antes de qualquer override do catálogo). Preenchido no
  // cliente ao aplicar `priceOverrides`; ausente = igual a salePrice.
  basePrice?: number;
  promotionalPrice: number | null;
  discount: number | null;
  savings: number | null;
  categoryName: string | null;
  currentStock: number;
  description: string | null;
};

// ── Aba "Lista" (planilha/PDF → catálogo) ──────────────────────────────────
// Cada linha da lista importada. Vira um "produto virtual" no render (não é um
// registro do banco): carrega nome, preços e a chave da imagem já embutida.
export type CatalogListItem = {
  id: string; // id estável da linha = id do produto virtual
  client: string; // agrupa/nomeia a página (quando groupBy = "client")
  productName: string;
  productId?: string; // produto do banco casado (referência; opcional)
  thumbnail?: string; // chave R2 do produto casado; "" = mockup
  normalPrice?: number; // "De" (Preço normal)
  offerPrice?: number; // "Por" (Preço da oferta)
  department?: string;
  startDate?: string;
  endDate?: string;
  // Pasta (página) no modo de agrupamento "custom". Nos modos client/department
  // a pasta é derivada de `client`/`department`.
  folder?: string;
};

// Lista importada (fonte editável), guardada no `config`. "Gerar" reconstrói as
// páginas a partir dela.
export type CatalogList = {
  items: CatalogListItem[];
  // Mapeamento campo→coluna do último import de planilha (contexto p/ reimport).
  mapping?: Record<string, string>;
  // Máx. de produtos por página (auto = maior pasta), editável.
  maxPerPage?: number;
  // Como dividir em pastas (cada pasta = uma página). Default "client".
  // "none" = sem agrupamento (uma única pasta com tudo).
  groupBy?: "client" | "department" | "custom" | "none";
  // Nome exibido de cada pasta (chave do grupo → nome). Permite renomear a aba.
  folderNames?: Record<string, string>;
  // Nome da oferta (espelha o nome do catálogo).
  offerName?: string;
};

// Chave crua do grupo de uma linha, conforme o modo de agrupamento.
export function itemFolderKey(
  item: CatalogListItem,
  groupBy: CatalogList["groupBy"],
): string {
  // "none" = tudo numa única pasta (sem agrupamento).
  if (groupBy === "none") return "";
  if (groupBy === "department")
    return item.department?.trim() || "Sem departamento";
  if (groupBy === "custom") return item.folder?.trim() || "Sem pasta";
  return item.client?.trim() || "Sem cliente";
}

// Pastas (páginas) resolvidas da lista, na ordem de 1ª aparição.
export function resolveFolders(
  list: CatalogList | undefined,
): { key: string; name: string; itemIds: string[] }[] {
  if (!list?.items?.length) return [];
  const groupBy = list.groupBy ?? "client";
  const names = list.folderNames ?? {};
  const order: string[] = [];
  const byKey = new Map<string, string[]>();
  for (const it of list.items) {
    const key = itemFolderKey(it, groupBy);
    const arr = byKey.get(key);
    if (arr) arr.push(it.id);
    else {
      byKey.set(key, [it.id]);
      order.push(key);
    }
  }
  return order.map((key) => ({
    key,
    name: names[key] ?? key,
    itemIds: byKey.get(key) ?? [],
  }));
}

// Converte as linhas da lista em produtos (virtuais) prontos para o render.
export function virtualProductsFromList(
  list: CatalogList | undefined,
): CatalogProduct[] {
  if (!list?.items?.length) return [];
  return list.items.map((it) => {
    // Preço base exibido (o "de"/riscado quando há promoção; senão o único preço).
    const salePrice = it.normalPrice ?? it.offerPrice ?? 0;
    // Só é PROMOÇÃO quando há um "de" (normalPrice) MAIOR que a oferta. Preço
    // único (só offerPrice) aparece limpo, sem "0% off".
    const promotionalPrice =
      it.normalPrice != null &&
      it.offerPrice != null &&
      it.offerPrice < it.normalPrice
        ? it.offerPrice
        : null;
    const discount =
      promotionalPrice != null && salePrice > 0
        ? ((salePrice - promotionalPrice) / salePrice) * 100
        : null;
    const savings =
      promotionalPrice != null ? salePrice - promotionalPrice : null;
    return {
      id: it.id,
      name: it.productName,
      sku: "",
      thumbnail: it.thumbnail ?? "",
      salePrice,
      unit: "UN",
      basePrice: salePrice,
      promotionalPrice,
      discount,
      savings,
      categoryName: it.department ?? null,
      currentStock: 0,
      description: null,
    };
  });
}

export const DEFAULT_CONFIG: CatalogConfig = {
  title: "Promoções",
  subtitle: "",
  showTitle: true,
  showSubtitle: true,
  pageSize: "square",
  layout: "grid-3",
  gridCols: 3,
  gridRows: 4,
  cardStyle: "standard",
  sortBy: "discount-desc",
  backgroundColor: "#ffffff",
  cardColor: "#ffffff",
  textSize: "sm",
  fontWeight: "medium",
  backgroundImage: "",
  backgroundFit: "cover",
  paddingTop: 24,
  paddingRight: 24,
  paddingBottom: 24,
  paddingLeft: 24,
  imageMargin: 0,
  imagePaddingTop: 0,
  imagePaddingRight: 0,
  imagePaddingBottom: 0,
  imagePaddingLeft: 0,
  hideImageBorder: false,
  hideImageShadow: false,
  hideImageBackground: false,
  hidePriceBorder: false,
  imageAdjustments: {},
  overlays: [],
  showDescription: false,
  showCategory: true,
  showStock: false,
  showSku: false,
  showUnit: true,
  excludedProductIds: [],
  manuallyAddedIds: [],
  categoryFilter: [],
  productOrder: [],
  priceOverrides: {},
  priceStyle: DEFAULT_PRICE_STYLE,
  priceStyleOverrides: {},
  footerText: "",
  footerTextSize: "xs",
  footerSupplierIds: [],
  showFooter: true,
  showFooterSuppliers: true,
  pages: [],
};
