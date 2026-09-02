/**
 * Tiers de qualidade.
 *
 * A experiência é a mesma em todos: o que muda é resolução de textura,
 * densidade de estrelas, camada de nuvens e teto de DPR. Nada de "versão
 * mobile sem narrativa".
 */

import { asset } from "./assets";

export type QualityTier = "high" | "medium" | "low";

export type QualitySettings = {
  tier: QualityTier;
  dpr: [number, number];
  textures: {
    day: string;
    night: string;
    clouds: string | null;
    bump: string | null;
    spec: string | null;
  };
  planetSegments: number;
  /**
   * Densidade da malha do mar. A onda grande sobrevive em qualquer valor;
   * o que cai com ele é o recorte fino da crista.
   */
  oceanSegments: number;
  stars: number;
  clouds: boolean;
  glow: boolean;
};

const BASE = "/orbita/textures";

/** Endereço de uma textura, já passando pelo mapa de sobrescrita. */
function texture(file: string) {
  return asset(`${BASE}/${file}`);
}

const HIGH: QualitySettings = {
  tier: "high",
  dpr: [1, 2],
  textures: {
    day: texture("earth-day-4k.webp"),
    night: texture("earth-night-4k.webp"),
    clouds: texture("earth-clouds-2k.webp"),
    bump: texture("earth-bump-2k.webp"),
    spec: texture("earth-spec.webp"),
  },
  planetSegments: 128,
  oceanSegments: 900,
  stars: 2600,
  clouds: true,
  glow: true,
};

const MEDIUM: QualitySettings = {
  tier: "medium",
  dpr: [1, 1.6],
  textures: {
    day: texture("earth-day-2k.webp"),
    night: texture("earth-night-2k.webp"),
    clouds: texture("earth-clouds-1k.webp"),
    bump: texture("earth-bump-2k.webp"),
    spec: texture("earth-spec.webp"),
  },
  planetSegments: 96,
  oceanSegments: 620,
  stars: 1500,
  clouds: true,
  glow: true,
};

const LOW: QualitySettings = {
  tier: "low",
  dpr: [1, 1.25],
  textures: {
    day: texture("earth-day-2k.webp"),
    night: texture("earth-night-2k.webp"),
    clouds: null,
    bump: null,
    spec: null,
  },
  planetSegments: 64,
  oceanSegments: 420,
  stars: 700,
  clouds: false,
  glow: false,
};

export function detectQuality(): QualitySettings {
  if (typeof window === "undefined") return MEDIUM;

  const cores = navigator.hardwareConcurrency ?? 4;
  const mem =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const w = window.innerWidth;
  const dpr = window.devicePixelRatio || 1;
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  // Um celular com muitos núcleos ainda tem orçamento térmico curto: o critério
  // combina CPU, memória e o custo real de pixels (largura × DPR).
  const pixelLoad = (w * dpr) / 1000;

  if (cores <= 4 || mem <= 2 || (coarse && pixelLoad > 3.2)) return LOW;
  if (coarse || cores <= 6 || mem <= 4 || w < 900) return MEDIUM;
  return HIGH;
}

export const PRELOAD_TEXTURES = [HIGH, MEDIUM, LOW];
