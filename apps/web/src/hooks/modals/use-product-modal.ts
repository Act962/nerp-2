import { create } from "zustand";

interface Product {
  id: string;
  name: string;
}

interface ProductModalStore {
  open: boolean;
  product?: Product;
  onSucess?: () => void;
  onOpen: (product?: Product, onSucess?: () => void) => void;
  onClose: () => void;
}

export const useProductModal = create<ProductModalStore>((set) => ({
  product: undefined,
  onSucess: undefined,
  open: false,
  onOpen: (product?: Product, onSucess?: () => void) =>
    set({ open: true, product, onSucess }),
  onClose: () => set({ open: false, product: undefined, onSucess: undefined }),
}));
