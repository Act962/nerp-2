import type { CatalogConfig } from "../types";

// Presets de fundo embutidos para o passo "Nome + fundo" do wizard da aba
// "Lista". Só cor/degradê (sem asset novo). Aplicar = espalhar estes campos de
// aparência no config (e propagar às páginas, que são per-página).
export type BackgroundPreset = {
  id: string;
  name: string;
  // Campos de aparência aplicados no config/páginas.
  bg: Pick<CatalogConfig, "backgroundColor"> &
    Partial<Pick<CatalogConfig, "backgroundGradient" | "backgroundOpacity">>;
};

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: "white", name: "Branco limpo", bg: { backgroundColor: "#ffffff" } },
  {
    id: "red",
    name: "Oferta vermelha",
    bg: {
      backgroundColor: "#e11d2a",
      backgroundGradient: { from: "#e11d2a", to: "#8a0f18", angle: 160 },
    },
  },
  {
    id: "yellow",
    name: "Promo amarela",
    bg: {
      backgroundColor: "#fbbf24",
      backgroundGradient: { from: "#fde047", to: "#f59e0b", angle: 160 },
    },
  },
  {
    id: "blue",
    name: "Azul",
    bg: {
      backgroundColor: "#1d4ed8",
      backgroundGradient: { from: "#3b82f6", to: "#1e3a8a", angle: 160 },
    },
  },
  {
    id: "green",
    name: "Verde",
    bg: {
      backgroundColor: "#16a34a",
      backgroundGradient: { from: "#22c55e", to: "#14532d", angle: 160 },
    },
  },
  {
    id: "dark",
    name: "Escuro",
    bg: {
      backgroundColor: "#0f172a",
      backgroundGradient: { from: "#1e293b", to: "#0f172a", angle: 160 },
    },
  },
];

// Estilo CSS de preview de um preset (para a miniatura no wizard).
export function presetPreviewStyle(p: BackgroundPreset): React.CSSProperties {
  const g = p.bg.backgroundGradient;
  return g
    ? { backgroundImage: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` }
    : { backgroundColor: p.bg.backgroundColor };
}
