import { create } from "zustand";

// Estado da UI do PDV compartilhado entre a barra do topo (botões Balança e
// Atalhos, no app-header) e a tela de venda, que hospeda os diálogos.
interface PdvUiState {
  weighedOpen: boolean;
  shortcutsOpen: boolean;
  setWeighedOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
}

export const usePdvUiStore = create<PdvUiState>((set) => ({
  weighedOpen: false,
  shortcutsOpen: false,
  setWeighedOpen: (weighedOpen) => set({ weighedOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
}));
