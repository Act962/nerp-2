import { Vector3 } from "three";

/**
 * A câmera do sobrevoo.
 *
 * Vive fora de `keyframes.ts` porque fala outra língua: lá as posições são
 * relativas ao planeta e a distância é ajustada pela proporção da tela; aqui
 * são metros acima de um mar que tem 2400 de lado. Misturar as duas tabelas
 * faria a câmera do espaço herdar a escala do mar, e vice-versa.
 *
 * O caminho desce de 150 para 11 e viaja no sentido do sol (`OCEAN_SUN`, em
 * -z): é o que traz o rastro de luz na água para dentro do quadro em vez de
 * deixá-lo às costas.
 */

type OceanCameraState = {
  at: number;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
};

const STATES: OceanCameraState[] = [
  /* O mar visto de cima, quando o branco abre. */
  { at: 0.0, position: [40, 150, 300], target: [-10, 0, -30], fov: 40 },
  { at: 0.3, position: [22, 62, 150], target: [-6, 2, -140], fov: 38 },
  /* Rasante: daqui a onda tem tamanho. */
  { at: 0.6, position: [8, 22, 30], target: [-2, 6, -260], fov: 36 },
  /* O horizonte, com o céu claro — é aqui que o convite acontece. */
  { at: 0.82, position: [0, 11, -70], target: [0, 12, -420], fov: 34 },
  /*
    A subida começa ainda sobre a água.

    O escurecimento só entra depois: primeiro se ganha altura de verdade, com o
    mar afastando embaixo, e é essa altura que faz a troca para o planeta
    parecer continuação em vez de corte.
  */
  { at: 1.0, position: [0, 260, -180], target: [0, 0, -330], fov: 40 },
];

const a = new Vector3();
const b = new Vector3();

const sampled = {
  position: new Vector3(),
  target: new Vector3(),
  fov: 40,
};

const ease = (t: number) => t * t * (3 - 2 * t);

export function sampleOceanCamera(phase: number) {
  const p = phase <= 0 ? 0 : phase >= 1 ? 1 : phase;
  let i = 0;
  while (i < STATES.length - 2 && p > STATES[i + 1].at) i++;

  const from = STATES[i];
  const to = STATES[i + 1];
  const span = to.at - from.at;
  const t = ease(span <= 0 ? 0 : (p - from.at) / span);

  a.set(...from.position);
  b.set(...to.position);
  sampled.position.copy(a).lerp(b, t);

  a.set(...from.target);
  b.set(...to.target);
  sampled.target.copy(a).lerp(b, t);

  sampled.fov = from.fov + (to.fov - from.fov) * t;
  return sampled;
}

/** O mar precisa enxergar longe; o espaço, não. */
export const OCEAN_FAR = 2600;
export const OCEAN_NEAR = 0.5;
