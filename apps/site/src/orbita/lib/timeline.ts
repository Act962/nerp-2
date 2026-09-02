/**
 * O comprimento da viagem — e o remapeamento que a esticou.
 *
 * A home cresceu de 10 para 18 telas de scroll, para caber a descida à Terra
 * (`specs/site-nossos-parceiros.md`). Cada bloco declara a própria janela em
 * progresso 0→1, então esticar o total sozinho moveria TUDO de lugar: uma
 * janela escrita em 0.775 passaria a cair quase o dobro de scroll adiante.
 *
 * `legacy()` desfaz esse deslocamento. Ele converte um progresso escrito para
 * a viagem antiga no progresso de hoje que cai na MESMA tela. Por isso as
 * janelas continuam escritas com os números originais — legíveis contra o
 * histórico e contra a spec — e o fator de conversão vive num lugar só.
 *
 * O que NÃO passa por `legacy()` é o que estava ancorado no FIM da viagem, e
 * não numa cena: o CTA, o rodapé e a saída do trilho de progresso. Eles
 * continuam no fim, agora depois da sequência nova.
 */

/** Telas de scroll da viagem inteira. Precisa bater com `--o-length` no CSS. */
export const SCREENS = 18;

/** A primeira tela é a cortina de abertura. */
export const INTRO_SCREENS = 1;

/** Fatia do scroll que pertence à abertura, o inverso de `--o-length`. */
export const INTRO_SHARE = INTRO_SCREENS / SCREENS;

/** Telas de órbita antes do alongamento: `--o-length` era 10, com 1 de cortina. */
const ORBIT_SCREENS_BEFORE = 9;

/** Telas de órbita hoje. */
const ORBIT_SCREENS_NOW = SCREENS - INTRO_SCREENS;

/**
 * Quanto da viagem de hoje a viagem antiga ocupa.
 *
 * 9/17, e não 10/18: a cortina continua com uma tela, então quem se esticou
 * foi só a órbita — de 9 telas para 17. Usar a razão dos totais deixaria tudo
 * o que já existe 5% mais lento, que é justamente o que este módulo evita.
 */
export const LEGACY_SPAN = ORBIT_SCREENS_BEFORE / ORBIT_SCREENS_NOW;

/** Um progresso escrito para a viagem de 10 telas, no lugar equivalente de hoje. */
export function legacy(progress: number) {
  return progress * LEGACY_SPAN;
}

/* -------------------------------------------------------------------------- */
/* A descida à Terra                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Os oito tempos do storyboard, em progresso.
 *
 * Eles ocupam o vão que o alongamento abriu: começam onde os números do
 * "Sobre" saem (`legacy(0.932)` ≈ 0.4934) e terminam onde o CTA entra (0.928).
 * São ~7,4 telas de scroll.
 *
 * Estão aqui, e não espalhados pelos componentes, porque cada tempo é lido por
 * mais de um lugar — a câmera, a cena e o bloco de texto precisam concordar
 * sobre onde ele começa. Uma tabela só evita que se afastem em silêncio.
 */
export const DESCENT = {
  /** A Terra ao longe, como hoje — a viagem só desacelera. */
  espaco: { from: 0.494, to: 0.53 },
  /** A câmera desce; o preto do espaço sai de cena. */
  descida: { from: 0.53, to: 0.596 },
  /** Os seis cartões de case sobre o planeta, com a nuvem engrossando. */
  cases: { from: 0.596, to: 0.672 },
  /** Branco total: a nave atravessa. */
  travessia: { from: 0.672, to: 0.726 },
  /** O branco abre sobre o mar; entram os quadros das marcas. */
  parceiros: { from: 0.726, to: 0.78 },
  /** O mar de perto e depois o horizonte. */
  mar: { from: 0.78, to: 0.828 },
  /** A frase e o cartão de vídeo. */
  convite: { from: 0.828, to: 0.872 },
  /**
   * A câmera sobe e reencontra o espaço.
   *
   * Mais longa que antes: a subida não é só sair do mar, é o inverso da
   * descida — o planeta reaparece colado e recua até o tamanho de sempre,
   * exatamente quando a frase final entra.
   */
  subida: { from: 0.872, to: 0.928 },
} as const;

/**
 * Onde o mar existe.
 *
 * Ele nasce ainda atrás do branco da travessia — assim a malha já está pronta
 * quando o branco abre — e sai quando a subida começa. Fora desta janela a
 * cena nem é montada: são ~1,6 milhão de triângulos que não têm por que
 * existir enquanto se olha o espaço.
 */
export const OCEAN = {
  from: DESCENT.travessia.from,
  /**
   * O mar sai depois do começo da subida, não no começo dela.
   *
   * A câmera ainda ganha altura sobre a água por um trecho — é a subida que o
   * storyboard pede — e só então a cena troca, já debaixo do escurecimento.
   */
  to: 0.888,
  /** A troca na entrada, coberta pelo branco da travessia. */
  blendIn: 0.02,
  /** A troca na saída, coberta pelo escurecimento da subida — mais curta. */
  blendOut: 0.006,
} as const;

/** 0 fora do mar, 1 dentro dele — a mistura das duas câmeras. */
export function oceanAmount(progress: number) {
  if (progress <= OCEAN.from - OCEAN.blendIn) return 0;
  if (progress >= OCEAN.to + OCEAN.blendOut) return 0;
  const entrada = (progress - (OCEAN.from - OCEAN.blendIn)) / OCEAN.blendIn;
  const saida = (OCEAN.to + OCEAN.blendOut - progress) / OCEAN.blendOut;
  return Math.max(0, Math.min(1, entrada, saida));
}

/** A fase dentro do mar, 0→1 — é o que move a câmera do alto até o horizonte. */
export function oceanPhase(progress: number) {
  const span = OCEAN.to - OCEAN.from;
  const t = span <= 0 ? 0 : (progress - OCEAN.from) / span;
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

/* -------------------------------------------------------------------------- */
/* A travessia: o branco e a nave                                             */
/* -------------------------------------------------------------------------- */

/**
 * A cortina branca — a nuvem.
 *
 * Ela não é um corte: engrossa com o scroll e abre com o scroll, e quem manda
 * no ritmo é sempre o dedo de quem lê. Nunca acontece sozinha.
 *
 * `full` não foi escolhido pelo desenho, e sim pela emenda: é exatamente onde
 * a câmera troca o espaço pelo mar (`OCEAN.from - OCEAN.blend`). O branco
 * cobre a troca, então o corte entre as duas cenas não é visto por ninguém.
 */
export const WHITE = {
  /*
    O branco começa tarde de propósito.

    Quem embranquece a tela primeiro é a camada de nuvem do planeta, que a
    câmera está atravessando; o véu entra só para fechar o que falta. Começar
    antes trocaria a nuvem de verdade por uma tela branca de CSS.
  */
  from: 0.64,
  full: OCEAN.from - OCEAN.blendIn,
  open: DESCENT.travessia.to,
  to: 0.757,
} as const;

/** A opacidade do branco: 0 fora, 1 na travessia. */
export function whiteAmount(progress: number) {
  if (progress <= WHITE.from || progress >= WHITE.to) return 0;
  if (progress < WHITE.full) {
    return (progress - WHITE.from) / (WHITE.full - WHITE.from);
  }
  if (progress <= WHITE.open) return 1;
  return (WHITE.to - progress) / (WHITE.to - WHITE.open);
}

/**
 * A órbita sai de cena na descida.
 *
 * O anel está a 1,7 raios do centro e a câmera mergulha até 1,45: continuar
 * desenhando-o significaria atravessá-lo. A saída acontece com o véu já em
 * 75%, e a volta com o véu da subida ainda cheio — nos dois casos, coberta.
 */
export function orbitVisible(progress: number) {
  const corte = WHITE.from + (WHITE.full - WHITE.from) * 0.75;
  return progress < corte || progress >= RISE.open;
}

/** A janela em que a nave atravessa — dentro do branco cheio, de ponta a ponta. */
export const CRAFT = { from: 0.666, to: 0.732 } as const;

/** A fase da travessia, 0 na borda esquerda e 1 na direita. */
export function craftPhase(progress: number) {
  const span = CRAFT.to - CRAFT.from;
  const t = span <= 0 ? 0 : (progress - CRAFT.from) / span;
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

/* -------------------------------------------------------------------------- */
/* A subida: deixar a atmosfera                                               */
/* -------------------------------------------------------------------------- */

/**
 * O escurecimento da subida.
 *
 * É o inverso da travessia, e de propósito não é branco: subindo, o que
 * acontece de verdade é o céu perdendo cor até o preto do espaço. Isso resolve
 * três coisas de uma vez — cobre a troca do mar pelo planeta, é fisicamente o
 * que se vê ganhando altitude, e deixa a virada do cromo acontecer com a tela
 * já escura, onde ninguém a pega.
 *
 * Como a cor do véu é a mesma do fundo do espaço, a saída dele não é uma
 * cortina abrindo: é o planeta surgindo do preto.
 */
export const RISE = {
  from: 0.872,
  full: 0.884,
  /*
    O véu só abre com a câmera já a 2,7 raios do centro.

    Abrir antes mostraria a textura do planeta a meio raio de altura, que é
    exatamente a distância em que o pixel dela aparece — o mesmo motivo pelo
    qual o mar é procedural e não o planeta visto de perto.
  */
  open: 0.902,
  to: 0.918,
} as const;

export function riseAmount(progress: number) {
  if (progress <= RISE.from || progress >= RISE.to) return 0;
  if (progress < RISE.full) {
    return (progress - RISE.from) / (RISE.full - RISE.from);
  }
  if (progress <= RISE.open) return 1;
  return (RISE.to - progress) / (RISE.to - RISE.open);
}

/**
 * Enquanto o fundo é claro, o cromo inverte.
 *
 * Vale para o branco E para o céu do sobrevoo, que são quatro tempos seguidos:
 * a barra, o logotipo e o trilho são claros e sumiriam nos dois. A troca é
 * discreta — um atributo na raiz, escrito só quando cruza o meio — e cai
 * dentro do branco, onde ninguém vê a virada.
 */
/*
  A virada acontece cedo na descida do véu, não no fim dela.

  O fundo do trecho é o mar claro escurecendo até o preto. Tinta escura só
  funciona enquanto o composto ainda é claro; tinta clara já funciona a partir
  do meio. Como o mar é um azul de brilho médio, o composto cruza esse meio
  bem antes do véu fechar — com ele em torno de 35%, e não de 100%, que era
  onde a barra passava um trecho ilegível.
*/
export const LIGHT = {
  from: 0.646,
  to: RISE.from + (RISE.full - RISE.from) * 0.35,
} as const;

export function isLight(progress: number) {
  return progress > LIGHT.from && progress < LIGHT.to;
}
