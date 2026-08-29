import { create } from "zustand";

// Item pronto pra virar linha do carrinho — casa com ProductSale do PDV.
// Vem do endpoint approve-pending (dados do produto atual + quantidade do
// pedido do catálogo).
export interface PendingCartItem {
  productId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  image: string | null;
  salePrice: number;
  costPrice: number;
  currentStock: number;
  minStock: number;
  unit: string;
  isActive: boolean;
  trackStock: boolean;
  quantity: number;
}

// Cliente completo do form da venda (schema pede document/email/phone/type).
export interface PendingCustomer {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  personType: "FISICA" | "JURIDICA";
}

// Estado da UI do PDV compartilhado entre a barra do topo (botões Balança,
// Novos pedidos e Atalhos, no app-header) e a tela de venda, que hospeda os
// diálogos e o carrinho (form).
interface PdvUiState {
  weighedOpen: boolean;
  /**
   * Token do celular pareado como leitor. Vive aqui porque quem gera o QR é o
   * cabeçalho (fora da árvore do PDV) e quem consome os códigos é a tela de
   * venda — o store é a ponte que já existe entre os dois.
   */
  scannerToken: string | null;
  shortcutsOpen: boolean;
  pendingOrdersOpen: boolean;
  // Payload de hidratação: quando setado por "Aprovar", o create-sale
  // consome uma vez e limpa. Payload junto = cliente da venda pendente.
  hydratePayload: {
    customer: PendingCustomer | null;
    items: PendingCartItem[];
  } | null;
  setWeighedOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setScannerToken: (token: string | null) => void;
  setPendingOrdersOpen: (open: boolean) => void;
  setHydratePayload: (
    payload: {
      customer: PendingCustomer | null;
      items: PendingCartItem[];
    } | null,
  ) => void;
}

export const usePdvUiStore = create<PdvUiState>((set) => ({
  weighedOpen: false,
  scannerToken: null,
  shortcutsOpen: false,
  pendingOrdersOpen: false,
  hydratePayload: null,
  setWeighedOpen: (weighedOpen) => set({ weighedOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setScannerToken: (scannerToken) => set({ scannerToken }),
  setPendingOrdersOpen: (pendingOrdersOpen) => set({ pendingOrdersOpen }),
  setHydratePayload: (hydratePayload) => set({ hydratePayload }),
}));
