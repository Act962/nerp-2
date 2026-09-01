/**
 * Fonte única de verdade do progresso do scroll.
 *
 * Fica fora do React de propósito: a cena 3D lê esse valor a 60fps dentro do
 * `useFrame` e os overlays leem no mesmo rAF. Se isso virasse state do React,
 * a árvore inteira re-renderizaria a cada pixel de scroll.
 */

import { Vector3 } from "three";

export type ScrollState = {
  /** Progresso bruto do scroll da página, 0 → 1. */
  progress: number;
  /** Progresso suavizado (o que a câmera realmente persegue). */
  smooth: number;
  /** Velocidade instantânea do scroll, usada para acentuar o movimento. */
  velocity: number;
  /** Ponteiro normalizado (-1 → 1) para o parallax de mouse. */
  pointerX: number;
  pointerY: number;
  /** Segundos desde o load — anima a cena mesmo com scroll parado. */
  time: number;
  /**
   * Progresso da cortina de abertura, 0 → 1.
   *
   * Vive separado de `progress` porque a abertura consome o primeiro terço de
   * tela do scroll e a órbita só começa depois dela. Assim as duas coisas
   * podem ser lidas ao mesmo tempo sem uma contaminar a outra.
   */
  intro: number;
  /**
   * Onde a esfera 3D está na tela, em pixels, e com que raio.
   *
   * É o que permite a passagem de bastão: o círculo branco chapado da abertura
   * pousa exatamente sobre a esfera renderizada e some, e ninguém vê a troca.
   */
  orb: { x: number; y: number; r: number; ready: boolean };
  /** A mesma esfera, mas em coordenadas de mundo — o device 3D se ancora nela. */
  orbWorld: { x: number; y: number; z: number };
  /** Raio da esfera em unidades de mundo. */
  orbScale: number;
  /** O mesmo, para o planeta: é para cá que o arco da abertura converge. */
  globe: { x: number; y: number; r: number; ready: boolean };
  /**
   * Modo produto.
   *
   * Clicar numa esfera da órbita abre o produto: a narrativa do scroll pausa,
   * a câmera vai até o nó e a roleta de funcionalidades assume a rolagem.
   * `t` é a transição de entrada e saída (0 = órbita, 1 = produto aberto) e
   * sobrevive à troca de produto, para a esfera nunca voltar ao tamanho pequeno
   * no meio do caminho.
   */
  /** Um painel da barra está aberto — o botão flutuante sai de cena. */
  menuOpen: boolean;

  product: {
    /** Ferramenta aberta, ou null na órbita. */
    id: string | null;
    /** Ângulo orbital do nó aberto — a câmera precisa dele mesmo na saída. */
    angle: number;
    /** Transição de entrada, 0 → 1. */
    t: number;
    /** Índice fracionário da roleta: o inteiro é o item em foco. */
    feature: number;
    /** Quantas funcionalidades o produto aberto tem. */
    featureCount: number;
    /** Nó sob o cursor na órbita, para o realce de hover. */
    hovered: string | null;
  };
};

export const scroll: ScrollState = {
  progress: 0,
  smooth: 0,
  velocity: 0,
  pointerX: 0,
  pointerY: 0,
  time: 0,
  intro: 0,
  orb: { x: 0, y: 0, r: 0, ready: false },
  orbWorld: { x: 0, y: 0, z: 0 },
  orbScale: 0.3,
  globe: { x: 0, y: 0, r: 0, ready: false },
  menuOpen: false,
  product: {
    id: null,
    angle: 0,
    t: 0,
    feature: 0,
    featureCount: 0,
    hovered: null,
  },
};

/* -------------------------------------------------------------------------- */
/* Âncoras: pontos 3D que "puxam" elementos HTML                              */
/* -------------------------------------------------------------------------- */

export type Anchor = {
  /** Posição no mundo, atualizada pela cena a cada frame. */
  position: Vector3;
  /** Elemento DOM que segue esse ponto. */
  el: HTMLElement | null;
  /** Distância câmera→ponto, normalizada, escrita pela cena. */
  depth: number;
  /** true quando o ponto está atrás do planeta ou fora do frustum. */
  hidden: boolean;
  /** 0→1: o quanto este nó está em foco na trajetória, escrito pela cena. */
  focus: number;
};

const anchors = new Map<string, Anchor>();

export function getAnchor(id: string): Anchor {
  let a = anchors.get(id);
  if (!a) {
    a = {
      position: new Vector3(),
      el: null,
      depth: 0,
      hidden: false,
      focus: 0,
    };
    anchors.set(id, a);
  }
  return a;
}

export function allAnchors() {
  return anchors;
}

/** Liga um elemento HTML a uma âncora 3D. Devolve o cleanup. */
export function bindAnchor(id: string, el: HTMLElement | null) {
  const a = getAnchor(id);
  a.el = el;
  return () => {
    if (a.el === el) a.el = null;
  };
}
