// Paleta da estrutura e derivação dos tons de sombra. Puro: sem React, sem
// Konva — o renderer só consome o que sai daqui.

export const DEFAULT_UPRIGHT_HEX = "#20409a";
export const DEFAULT_BEAM_HEX = "#e8621d";
export const OVERFLOW_HEX = "#dc2626";

/** Cores comuns de porta-palete e gôndola no mercado brasileiro. */
export const RACK_COLOR_SWATCHES = [
  { hex: "#20409a", label: "Azul" },
  { hex: "#e8621d", label: "Laranja" },
  { hex: "#b3b8c2", label: "Cinza" },
  { hex: "#1f9d55", label: "Verde" },
  { hex: "#c5283d", label: "Vermelho" },
  { hex: "#f2b705", label: "Amarelo" },
  { hex: "#2f3640", label: "Grafite" },
  { hex: "#f4f6f8", label: "Branco" },
] as const;

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

export function isValidHex(value: string): boolean {
  return HEX_PATTERN.test(value);
}

/**
 * Escurece (ou clareia, com fator > 1) uma cor hex.
 *
 * As sombras da estrutura — faixa lateral do montante, dobra da longarina,
 * garras da cantoneira — são DERIVADAS da cor escolhida, nunca persistidas.
 * Guardar os três tons obrigaria a mantê-los em sincronia a cada troca.
 */
export function shadeHex(hex: string, factor: number): string {
  if (!isValidHex(hex)) return hex;

  const channels = [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );

  return `#${channels
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, channel * factor)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** Cor legível sobre um fundo — o branco some numa estrutura branca. */
export function contrastInkFor(hex: string): string {
  if (!isValidHex(hex)) return "#0f172a";
  const [red, green, blue] = [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 150 ? "#0f172a" : "#ffffff";
}
