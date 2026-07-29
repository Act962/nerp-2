// Paleta pastel fixa — "sempre cor pastel" é uma restrição do produto, não
// uma preferência do usuário, então não existe seletor de cor livre aqui, só
// esses 8 tons. A key é o que persiste em DashboardWidget.color; o hex nunca
// muda de significado depois de escolhido (evita widget salvo virando outra
// cor se a paleta for retocada no futuro).
export const PASTEL_COLORS = [
  { key: "rose", label: "Rosa", hex: "#f9a8d4" },
  { key: "peach", label: "Pêssego", hex: "#fdba74" },
  { key: "yellow", label: "Amarelo", hex: "#fde047" },
  { key: "mint", label: "Menta", hex: "#86efac" },
  { key: "sky", label: "Céu", hex: "#7dd3fc" },
  { key: "lavender", label: "Lavanda", hex: "#c4b5fd" },
  { key: "coral", label: "Coral", hex: "#fca5a5" },
  { key: "teal", label: "Turquesa", hex: "#5eead4" },
] as const;

export type PastelColorKey = (typeof PASTEL_COLORS)[number]["key"];

const HEX_BY_KEY = new Map<string, string>(
  PASTEL_COLORS.map((color) => [color.key, color.hex]),
);

export function pastelHex(key: string | null | undefined): string | null {
  if (!key) return null;
  return HEX_BY_KEY.get(key) ?? null;
}
