export type CatalogConfig = {
  title: string;
  subtitle: string;
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
  showDescription: boolean;
  showCategory: boolean;
  showStock: boolean;
  showSku: boolean;
  excludedProductIds: string[];
  manuallyAddedIds: string[];
  categoryFilter: string[];
};

export const DEFAULT_CONFIG: CatalogConfig = {
  title: "Promoções",
  subtitle: "",
  layout: "grid-3",
  cardStyle: "standard",
  sortBy: "discount-desc",
  backgroundColor: "#ffffff",
  cardColor: "#ffffff",
  showDescription: false,
  showCategory: true,
  showStock: false,
  showSku: false,
  excludedProductIds: [],
  manuallyAddedIds: [],
  categoryFilter: [],
};
