import { Vector3 } from "three";
import { legacy } from "./timeline";

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
  /**
   * Quanto a posição obedece ao ajuste por proporção de tela, de 1 a 0.
   *
   * Enquadrar o planeta de longe pede esse ajuste: numa tela estreita a câmera
   * precisa recuar para o conjunto caber. Descer até a superfície, não — ali a
   * distância é o assunto, e multiplicá-la por 2 num retrato deixaria a câmera
   * a 3 raios de altura em vez de meio. Da órbita à nuvem o valor cai de 1 a 0,
   * e a interpolação faz a troca sem costura.
   */
  fit?: number;
};

export const CAMERA_STATES: CameraState[] = [
  {
    at: legacy(0.0),
    label: "01 — Visão inicial",
    position: [0.75, 0.35, 4.6],
    target: [-0.29, 0.05, 0],
    fov: 34,
    sway: 1,
    roll: 0,
  },
  {
    at: legacy(0.1),
    label: "02 — Aproximação",
    position: [0.6, 0.5, 4.2],
    target: [-0.34, 0.1, 0],
    fov: 34,
    sway: 0.85,
    roll: 0.008,
  },
  {
    at: legacy(0.2),
    label: "03 — Entrada na órbita",
    position: [0.05, 1.0, 4.15],
    target: [-0.5, 0.24, 0.05],
    fov: 36,
    sway: 0.7,
    roll: 0.02,
  },
  {
    at: legacy(0.34),
    label: "04 — Soluções",
    position: [-0.7, 1.15, 4.3],
    target: [-0.62, 0.26, 0.1],
    fov: 37,
    sway: 0.6,
    roll: 0.015,
  },
  {
    at: legacy(0.48),
    label: "05 — Soluções (percurso)",
    position: [-1.95, 0.95, 4.0],
    target: [-0.7, 0.12, 0.05],
    fov: 38,
    sway: 0.6,
    roll: -0.015,
  },
  {
    at: legacy(0.62),
    label: "06 — Produtos",
    position: [-3.9, 0.15, 1.85],
    target: [-0.75, -0.02, -0.15],
    fov: 40,
    sway: 0.5,
    roll: -0.035,
  },
  {
    at: legacy(0.72),
    label: "06b — Contorno",
    position: [-3.5, -0.75, -1.35],
    target: [-0.6, -0.28, -0.5],
    fov: 42,
    sway: 0.4,
    roll: -0.055,
  },
  {
    at: legacy(0.81),
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
    at: legacy(0.885),
    label: "08 — Sobre",
    position: [0.1, 0.45, 7.4],
    target: [-0.35, 0.2, 0],
    fov: 32,
    sway: 0.55,
    roll: 0,
  },

  /*
    A descida à Terra.

    O planeta não some para o mar aparecer: a câmera desce até ele. O que
    embranquece a tela é a própria camada de nuvem, que cresce no quadro até
    tomá-la — o véu branco só termina o trabalho, e termina antes de a textura
    chegar perto o bastante para o pixel aparecer.

    `sway` vai a zero: empurrão de mouse a meio raio de altura vira tremor.
  */
  {
    at: 0.545,
    label: "09 — Descida: o planeta cresce",
    position: [0.08, 0.38, 5.0],
    target: [-0.2, 0.12, 0],
    fov: 33,
    sway: 0.35,
    roll: 0,
    fit: 0.75,
  },
  {
    at: 0.596,
    label: "10 — Descida: as nuvens",
    position: [0.04, 0.2, 2.4],
    target: [-0.05, 0.04, 0],
    fov: 40,
    sway: 0.15,
    roll: 0,
    fit: 0.25,
  },
  {
    /*
      Aqui o planeta TOMA a tela: a 1,35 raios ele cobre 95° e o quadro não tem
      mais canto preto. O véu branco começa exatamente neste ponto — antes
      dele, o que embranquece é a nuvem de verdade; depois, não há mais o que
      mostrar sem a textura denunciar a proximidade.
    */
    at: 0.64,
    label: "11 — Dentro da nuvem",
    position: [0.01, 0.08, 1.35],
    target: [0, 0.02, 0],
    fov: 52,
    sway: 0,
    roll: 0,
    fit: 0,
  },

  /*
    A subida é a descida ao contrário.

    Da nuvem ao espaço pelo mesmo caminho, e no mesmo enquadramento em que a
    viagem sempre terminou: quando a frase final entra, o planeta já está do
    tamanho de hoje. O trecho entre 0.664 e 0.886 é o sobrevoo — a câmera do
    espaço fica parada dentro da nuvem, porque quem está em cena é o mar.
  */
  {
    at: 0.886,
    label: "12 — Saída da nuvem",
    position: [0.01, 0.08, 1.35],
    target: [0, 0.02, 0],
    fov: 52,
    sway: 0,
    roll: 0,
    fit: 0,
  },
  {
    at: 0.906,
    label: "13 — Afastando: as nuvens",
    position: [0.05, 0.24, 2.7],
    target: [-0.06, 0.05, 0],
    fov: 40,
    sway: 0.15,
    roll: 0,
    fit: 0.25,
  },
  {
    at: 0.918,
    label: "14 — Afastando: o planeta inteiro",
    position: [0.16, 0.5, 4.4],
    target: [-0.2, 0.16, 0],
    fov: 35,
    sway: 0.3,
    roll: 0,
    fit: 0.6,
  },
  {
    at: 0.93,
    label: "15 — De volta ao enquadramento de sempre",
    position: [0.62, 0.9, 7.7],
    target: [0.24, 0.7, 0.12],
    fov: 31,
    sway: 0.4,
    roll: 0,
    fit: 1,
  },
  /*
    O CTA e o rodapé não passam por `legacy()`.

    Eles nunca estiveram presos a uma cena: estão presos ao FIM da viagem. Com
    a descida à Terra inserida antes deles, o fim é outro ponto do scroll — e é
    para lá que devem ir, não para onde a viagem antiga acabava.
  */
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
  fit: number;
};

const sampled: SampledCamera = {
  position: new Vector3(),
  target: new Vector3(),
  fov: 34,
  sway: 1,
  roll: 0,
  fit: 1,
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
  const fitA = a.fit ?? 1;
  const fitB = b.fit ?? 1;
  sampled.fit = fitA + (fitB - fitA) * t;
  return sampled;
}
