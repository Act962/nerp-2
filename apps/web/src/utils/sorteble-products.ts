import { ProductCatalog } from "@/features/storefront/types/product";

export function sortProducts(products: any, method: string) {
  const sorted = [...products];

  switch (method) {
    case "ASC":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));

    case "DESC":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));

    case "NEWEST":
      // data maior = produto mais novo
      return sorted.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

    case "OLDEST":
      // data menor = produto mais antigo
      return sorted.sort((a, b) => Number(a.createdAt) - Number(b.createdAt));

    default:
      return sorted;
  }
}
