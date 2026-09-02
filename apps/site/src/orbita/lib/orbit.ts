import { Vector3 } from "three";

/**
 * A órbita é a estrutura da página.
 *
 * Tudo — câmera, símbolo, estações, produtos — é posicionado a partir desta
 * elipse inclinada ao redor do planeta (raio 1 na origem). O símbolo 3D não é
 * "colado por cima" do planeta: ele ocupa uma posição real no espaço e, quando
 * o ângulo o leva para trás do globo, o próprio z-buffer o esconde.
 */

export const PLANET_RADIUS = 1;

export const ORBIT = {
  /** Semi-eixos da elipse (o plano é levemente elíptico, como órbita real). */
  a: 1.72,
  b: 1.58,
  /**
   * Inclinação do plano orbital.
   *
   * Negativa de propósito: assim a metade alta da trajetória é também a
   * metade próxima da câmera. O símbolo sobe passando na FRENTE do planeta
   * e mergulha por trás dele — que é a leitura de órbita do storyboard.
   */
  inclination: -0.42,
  /** Rotação do plano em torno de Y (longitude do nó ascendente). */
  node: -0.34,
};

const cosI = Math.cos(ORBIT.inclination);
const sinI = Math.sin(ORBIT.inclination);
const cosN = Math.cos(ORBIT.node);
const sinN = Math.sin(ORBIT.node);

/** Posição no mundo para um ângulo (radianos) da órbita. */
export function orbitPosition(angle: number, out = new Vector3()) {
  const x = Math.cos(angle) * ORBIT.a;
  const z = Math.sin(angle) * ORBIT.b;
  // inclina em X, depois gira em Y
  const y1 = -z * sinI;
  const z1 = z * cosI;
  out.set(x * cosN + z1 * sinN, y1, -x * sinN + z1 * cosN);
  return out;
}

/** Tangente normalizada — direção de voo do símbolo naquele ponto. */
export function orbitTangent(angle: number, out = new Vector3()) {
  const e = 0.001;
  const a = orbitPosition(angle + e, new Vector3());
  const b = orbitPosition(angle - e, out);
  return a.sub(b).normalize();
}

/**
 * Mapa scroll → ângulo orbital.
 *
 * Não é linear de propósito: o símbolo desacelera nos momentos de leitura
 * (hero, impacto, CTA) e acelera nas transições, que é o que dá a sensação
 * de câmera cinematográfica em vez de rotação de banner.
 */
const ANGLE_KEYS: Array<[number, number]> = [
  [0.0, 0.62],
  [0.16, 1.05],
  [0.25, 1.25],
  [0.31, 1.6],
  [0.37, 1.95],
  [0.43, 2.3],
  [0.49, 2.65],
  [0.58, 3.0],
  [0.63, 3.25],
  [0.68, 3.5],
  [0.73, 3.75],
  [0.81, 4.3],
  [0.89, 5.3],
  [1.0, 6.28],
];

export function orbitAngleAt(progress: number) {
  const p = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;
  for (let i = 0; i < ANGLE_KEYS.length - 1; i++) {
    const [p0, a0] = ANGLE_KEYS[i];
    const [p1, a1] = ANGLE_KEYS[i + 1];
    if (p <= p1) {
      const t = (p - p0) / (p1 - p0);
      const s = t * t * (3 - 2 * t);
      return a0 + (a1 - a0) * s;
    }
  }
  return ANGLE_KEYS[ANGLE_KEYS.length - 1][1];
}

/**
 * Onde cada ferramenta fica na trajetória.
 *
 * As 19 esferas ocupam o trecho da órbita que passa na frente do planeta e
 * mergulha para trás dele — o mesmo trecho que o scroll percorre entre o hero
 * e o momento de impacto. O espaçamento é constante: a órbita é um mapa da
 * suíte, e nenhuma ferramenta ganha mais espaço que outra por acaso.
 */
export const TOOL_ARC = { start: 1.12, end: 4.32 };

export function toolAngles(count: number) {
  if (count <= 1) return [(TOOL_ARC.start + TOOL_ARC.end) / 2];
  const step = (TOOL_ARC.end - TOOL_ARC.start) / (count - 1);
  return Array.from({ length: count }, (_, i) => TOOL_ARC.start + i * step);
}

/** Progresso do scroll em que um ângulo da órbita entra em foco. */
export function progressForAngle(angle: number) {
  for (let i = 0; i < ANGLE_KEYS.length - 1; i++) {
    const [p0, a0] = ANGLE_KEYS[i];
    const [p1, a1] = ANGLE_KEYS[i + 1];
    if (angle <= a1) {
      const t = (angle - a0) / (a1 - a0 || 1);
      return p0 + (p1 - p0) * Math.max(0, Math.min(1, t));
    }
  }
  return 1;
}
