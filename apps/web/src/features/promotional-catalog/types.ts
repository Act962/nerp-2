export type CatalogConfig = {
  title: string;
  subtitle: string;
  pageSize: "square" | "story";
  layout: "grid-2" | "grid-3" | "grid-4" | "list" | "featured" | "carousel" | "masonry" | "table";
  cardStyle: "compact" | "standard" | "list" | "countdown" | "badge-hot" | "minimal";
  sortBy: "discount-desc" | "price-asc" | "price-desc" | "name-asc" | "savings-desc";
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
  showDescription: boolean;
  showCategory: boolean;
  showStock: boolean;
  showSku: boolean;
  excludedProductIds: string[];
  manuallyAddedIds: string[];
  categoryFilter: string[];
  footerText: string;
  footerTextSize: CatalogConfig["textSize"];
  footerSupplierIds: string[];
};

export const TEXT_SIZE_CSS: Record<CatalogConfig["textSize"], string> = {
  xs:   "0.75rem",   // 12px
  sm:   "1rem",      // 16px
  base: "1.375rem",  // 22px
  lg:   "1.875rem",  // 30px
  xl:   "2.5rem",    // 40px
  "2xl": "3.25rem",  // 52px
  "3xl": "4rem",     // 64px
  "4xl": "5rem",     // 80px
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
  showDescription: false,
  showCategory: true,
  showStock: false,
  showSku: false,
  excludedProductIds: [],
  manuallyAddedIds: [],
  categoryFilter: [],
  footerText: "",
  footerTextSize: "xs",
  footerSupplierIds: [],
};
