import { Vector3 } from "three";

/**
 * Os 9 estados de câmera da narrativa.
 *
 * A câmera é personagem: ela não "pula" entre seções, ela percorre uma curva
 * contínua. Cada estado guarda posição, alvo do olhar, fov e o quanto o
 * ponteiro do mouse consegue empurrar a câmera naquele momento.
 */
export type CameraState = {
  at: number;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  /** Intensidade do parallax de mouse (0 = travado). */
  sway: number;
  /** Roll da câmera em radianos — usado no momento de impacto. */
  roll: number;
};

export const CAMERA_STATES: CameraState[] = [
  {
    at: 0.0,
    label: "01 — Visão inicial",
    position: [0.75, 0.35, 4.6],
    target: [-0.29, 0.05, 0],
    fov: 34,
    sway: 1,
    roll: 0,
  },
  {
    at: 0.1,
    label: "02 — Aproximação",
    position: [0.6, 0.5, 4.2],
    target: [-0.34, 0.1, 0],
    fov: 34,
    sway: 0.85,
    roll: 0.008,
  },
  {
    at: 0.2,
    label: "03 — Entrada na órbita",
    position: [0.05, 1.0, 4.15],
    target: [-0.5, 0.24, 0.05],
    fov: 36,
    sway: 0.7,
    roll: 0.02,
  },
  {
    at: 0.34,
    label: "04 — Soluções",
    position: [-0.7, 1.15, 4.3],
    target: [-0.62, 0.26, 0.1],
    fov: 37,
    sway: 0.6,
    roll: 0.015,
  },
  {
    at: 0.48,
    label: "05 — Soluções (percurso)",
    position: [-1.95, 0.95, 4.0],
    target: [-0.7, 0.12, 0.05],
    fov: 38,
    sway: 0.6,
    roll: -0.015,
  },
  {
    at: 0.62,
    label: "06 — Produtos",
    position: [-3.9, 0.15, 1.85],
    target: [-0.75, -0.02, -0.15],
    fov: 40,
    sway: 0.5,
    roll: -0.035,
  },
  {
    at: 0.72,
    label: "06b — Contorno",
    position: [-3.5, -0.75, -1.35],
    target: [-0.6, -0.28, -0.5],
    fov: 42,
    sway: 0.4,
    roll: -0.055,
  },
  {
    at: 0.81,
    label: "07 — Impacto",
    position: [-0.52, -1.42, -3.55],
    // O alvo não é o símbolo: é um ponto à esquerda dele. É isso que joga o
    // objeto para a direita do quadro e abre o canto esquerdo para a frase.
    target: [0.33, -0.74, -1.55],
    fov: 46,
    sway: 0.3,
    roll: -0.08,
  },
  {
    at: 0.885,
    label: "08 — Sobre",
    position: [0.1, 0.45, 7.4],
    target: [-0.35, 0.2, 0],
    fov: 32,
    sway: 0.55,
    roll: 0,
  },
  {
    at: 0.955,
    label: "09 — CTA",
    position: [0.7, 0.95, 8.0],
    target: [0.3, 0.78, 0.15],
    fov: 30,
    sway: 0.4,
    roll: 0,
  },
  {
    at: 1.0,
    label: "10 — Footer",
    position: [0.6, 1.05, 8.6],
    target: [0.3, 0.55, 0.1],
    fov: 30,
    sway: 0.25,
    roll: 0,
  },
];

const tmpA = new Vector3();
const tmpB = new Vector3();

export type SampledCamera = {
  position: Vector3;
  target: Vector3;
  fov: number;
  sway: number;
  roll: number;
};

const sampled: SampledCamera = {
  position: new Vector3(),
  target: new Vector3(),
  fov: 34,
  sway: 1,
  roll: 0,
};

const ease = (t: number) => t * t * (3 - 2 * t);

/** Interpola os estados de câmera para um progresso arbitrário. */
export function sampleCamera(progress: number): SampledCamera {
  const p = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;
  let i = 0;
  while (i < CAMERA_STATES.length - 2 && p > CAMERA_STATES[i + 1].at) i++;

  const a = CAMERA_STATES[i];
  const b = CAMERA_STATES[i + 1];
  const span = b.at - a.at;
  const t = ease(span <= 0 ? 0 : (p - a.at) / span);

  tmpA.set(...a.position);
  tmpB.set(...b.position);
  sampled.position.copy(tmpA).lerp(tmpB, t);

  tmpA.set(...a.target);
  tmpB.set(...b.target);
  sampled.target.copy(tmpA).lerp(tmpB, t);

  sampled.fov = a.fov + (b.fov - a.fov) * t;
  sampled.sway = a.sway + (b.sway - a.sway) * t;
  sampled.roll = a.roll + (b.roll - a.roll) * t;
  return sampled;
}
