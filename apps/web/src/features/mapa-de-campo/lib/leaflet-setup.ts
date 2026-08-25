import type { LatLngExpression } from "leaflet";

/** Centro do Brasil, para o primeiro render antes de haver loja. */
export const BRAZIL_CENTER: LatLngExpression = [-14.235, -51.925];
export const BRAZIL_ZOOM = 4;

export const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
/** Atribuição é exigência de licença do OpenStreetMap, não enfeite. */
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Cor do pino por procedência da coordenada. */
export const PIN_COLOR = {
  reliable: "#10b981",
  approximate: "#f59e0b",
  manual: "#0ea5e9",
  /**
   * Rota planejada do promotor. Fora da escala de confiança porque não descreve
   * uma posição: descreve uma decisão.
   */
  route: "#0f172a",
} as const;

/** Paleta do trajeto: uma cor por promotor, estável pelo índice. */
export const TRAIL_COLORS = [
  "#7c3aed",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#84cc16",
];

export function trailColor(index: number): string {
  return TRAIL_COLORS[index % TRAIL_COLORS.length];
}
