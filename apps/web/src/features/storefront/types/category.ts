export interface CategoryCatalog {
  id: string;
  name: string;
  isActive: boolean;
  slug: string;
  image: string | null;
  order: number;
}
