import { create } from "zustand";

interface CreateProductsModalStore {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export const useCreateProductsModal = create<CreateProductsModalStore>(
  (set) => ({
    open: false,
    onOpen: () => set({ open: true }),
    onClose: () => set({ open: false }),
  })
);
