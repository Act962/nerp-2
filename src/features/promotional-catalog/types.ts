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
  assetKey: string; // chave R2 do PNG
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number; // graus
};

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
  layout:
    | "grid-2"
    | "grid-3"
    | "grid-4"
    | "list"
    | "featured"
    | "carousel"
    | "masonry"
    | "table";
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
  cardColor: string;
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
  showDescription: boolean;
  showCategory: boolean;
  showStock: boolean;
  showSku: boolean;
  // Mostra a unidade (kg/un/cx…) ao lado do preço no card.
  showUnit: boolean;
  excludedProductIds: string[];
  manuallyAddedIds: string[];
  categoryFilter: string[];
  // Ordem manual dos produtos (productId[]). Quando preenchida, tem prioridade
  // sobre `sortBy`: os ids listados vêm primeiro nessa sequência; os demais
  // seguem no fim pela ordenação automática. Vazio = só `sortBy`.
  productOrder?: string[];
  // Preço normal sobrescrito SÓ para exibição neste catálogo (productId → valor).
  // Não altera o produto no banco — o card e o desconto seguem este valor.
  priceOverrides: Record<string, number>;
  // Estilo padrão do preço (aplica a todos) + override por produto.
  priceStyle: PriceStyle;
  priceStyleOverrides: Record<string, PriceStyle>;
  footerText: string;
  footerTextSize: CatalogConfig["textSize"];
  footerSupplierIds: string[];
  // Liga/desliga o rodapé de texto e os logos de fornecedores (default: ligado).
  showFooter: boolean;
  showFooterSuppliers: boolean;
};

// Campos específicos de produto — NÃO entram num padrão (preset de estilo).
// Ao aplicar um padrão, esses campos do catálogo atual são preservados.
const TEMPLATE_OMIT_KEYS = [
  "excludedProductIds",
  "manuallyAddedIds",
  "categoryFilter",
  "priceOverrides",
  "priceStyleOverrides",
  "imageAdjustments",
  "productOrder",
  "overlays",
] as const;

// Extrai só a aparência do catálogo para salvar como padrão.
export function toTemplateConfig(
  config: CatalogConfig,
): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...config };
  for (const key of TEMPLATE_OMIT_KEYS) delete clone[key];
  return clone;
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

export const DEFAULT_CONFIG: CatalogConfig = {
  title: "Promoções",
  subtitle: "",
  showTitle: true,
  showSubtitle: true,
  pageSize: "square",
  layout: "grid-3",
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
};
