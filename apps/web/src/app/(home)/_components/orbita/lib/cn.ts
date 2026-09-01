export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const clamp = (v: number, min = 0, max = 1) =>
  v < min ? min : v > max ? max : v;

/** Progresso 0→1 dentro de uma janela do scroll global. */
export const range = (value: number, start: number, end: number) =>
  clamp((value - start) / (end - start));

/** Sobe de 0→1 e volta a 0, com platôs de entrada/saída. */
export const window01 = (
  value: number,
  inStart: number,
  inEnd: number,
  outStart: number,
  outEnd: number,
) => Math.min(range(value, inStart, inEnd), 1 - range(value, outStart, outEnd));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Damping independente de framerate. */
export const damp = (
  current: number,
  target: number,
  lambda: number,
  dt: number,
) => lerp(current, target, 1 - Math.exp(-lambda * dt));
