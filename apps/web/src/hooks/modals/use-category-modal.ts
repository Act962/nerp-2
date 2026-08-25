import { create } from "zustand";

type Category = {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  parentId?: string;
};

interface CategoryModalStore {
  id: string | undefined;
  open: boolean;
  category: Category | null;
  openDelete: boolean;
  onOpen: () => void;
  onClose: () => void;
  onOpenDelete: () => void;
  onCloseDelete: () => void;
  setCategory: (category: Category | null) => void;
  mode: "create" | "update";
  setMode: (mode: "create" | "update") => void;
}

export const useCategoryModal = create<CategoryModalStore>((set) => ({
  id: undefined,
  open: false,
  openDelete: false,
  category: null,
  onOpen: () => set({ open: true }),
  onClose: () => set({ open: false, category: null, mode: "create" }),
  onOpenDelete: () => set({ openDelete: true }),
  onCloseDelete: () => set({ openDelete: false, category: null }),
  setCategory: (category: Category | null) => set({ category }),
  mode: "create",
  setMode: (mode: "create" | "update") => set({ mode }),
}));
