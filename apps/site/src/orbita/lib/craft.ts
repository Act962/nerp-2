/**
 * A geometria da travessia — a nave e o corte que ela abre.
 *
 * Vive fora dos componentes porque duas pontas precisam concordar sobre a
 * mesma linha: quem desenha a nave e quem apaga a nuvem atrás dela. Se cada
 * uma calculasse por si, a nuvem abriria alguns pixels antes ou depois da asa,
 * e o efeito inteiro — a nave levando o branco embora — se desfaz.
 */

/** Envergadura em alturas de tela: garante as asas passando das duas bordas. */
export const CRAFT_SPAN = 1.18;

/** Comprimento ÷ envergadura, medido no arquivo (1400 × 910). */
export const CRAFT_RATIO = 1400 / 910;

/**
 * Onde a asa cruza o comprimento, com a nave de nariz à direita.
 *
 * A asa está a 73,6% da altura da imagem; deitada, isso a põe a 23,6% do
 * comprimento à esquerda do centro.
 */
export const CRAFT_WING = 0.236;

/** Deslocamento horizontal, em larguras de tela: entra fora e sai fora. */
export function craftOffset(phase: number) {
  return -1.15 + 2.3 * phase;
}

/** Ela se afasta um pouco enquanto atravessa. */
export function craftScale(phase: number) {
  return 1.08 - 0.18 * phase;
}

/**
 * A linha da asa, em fração da largura da tela.
 *
 * Abaixo de 0 a nave ainda não entrou e a nuvem está inteira; acima de 1 ela
 * já saiu e não sobrou nuvem nenhuma.
 */
export function craftCut(phase: number, aspect: number) {
  const escala = craftScale(phase);
  // Comprimento em larguras de tela: envergadura (em alturas) × razão ÷ aspecto.
  const comprimento =
    (CRAFT_SPAN * CRAFT_RATIO * escala) / Math.max(aspect, 0.2);
  const centro = 0.5 + craftOffset(phase);
  return centro - CRAFT_WING * comprimento;
}
