// Paleta pastel curada — atalho para o usuário que quer só escolher uma cor
// coerente com o resto do dashboard. Continua sendo o CAMINHO PADRÃO, mas o
// campo de cor agora aceita também um hex livre (conta-gotas): a validação
// abaixo cobre os dois formatos.
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

/**
 * Cor guardada no widget: uma das chaves da paleta OU um hex livre
 * `#rrggbb` vindo do conta-gotas. `null` = tom padrão do tema.
 *
 * String em vez de union estreita porque o tipo TS não distingue os dois
 * casos em runtime — a validação é feita por `widgetColorSchema` na entrada
 * e por `resolveWidgetColor` na leitura.
 */
export type WidgetColor = string;

const HEX_BY_KEY = new Map<string, string>(
  PASTEL_COLORS.map((color) => [color.key, color.hex]),
);

/** `#rrggbb` — o formato do `<input type="color">` e o único aceito no wire. */
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(color: string): boolean {
  return HEX_COLOR_RE.test(color);
}

/**
 * Resolve a cor para hex renderizável.
 *  - key de paleta → hex da paleta
 *  - hex livre     → devolve como está
 *  - qualquer outra coisa (inclusive keys removidas da paleta) → null
 */
export function resolveWidgetColor(
  color: string | null | undefined,
): string | null {
  if (!color) return null;
  const fromPalette = HEX_BY_KEY.get(color);
  if (fromPalette) return fromPalette;
  return isHexColor(color) ? color : null;
}

/**
 * Retrocompatível: nomes antigos que só entendiam a paleta continuam
 * chamando `pastelHex`, agora com fallback para o hex livre.
 */
export const pastelHex = resolveWidgetColor;
