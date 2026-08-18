export interface ProductCatalog {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  salePrice: number;
  description?: string;
  images?: string[];
  thumbnail: string;
  createdAt?: Date;
}

export interface CartItem extends Omit<ProductCatalog, "images"> {
  quantity: number;
}

export type DeliveryMethod = "delivery" | "pickup";
export type PaymentMethod = "pix" | "credit" | "debit" | "cash";
