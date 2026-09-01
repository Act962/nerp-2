/**
 * Os arquivos oficiais da marca, e as medidas tiradas deles.
 *
 * Nada aqui é desenhado: o logotipo e o símbolo são os PNGs entregues pela
 * ÓRBITA, apenas recortados e convertidos para WebP. Os números abaixo foram
 * medidos no próprio arquivo do símbolo — é assim que a animação sabe onde a
 * esfera se apoia no arco sem que ninguém tenha que redesenhar a marca.
 *
 * O recorte do arco é quadrado e centrado no centro do círculo, com meia
 * largura igual ao raio externo. Traduzindo: `imagem.clientWidth / 2` **é** o
 * raio externo do arco na tela, em pixels.
 */
import { asset } from "../lib/assets";

export const BRAND = {
  /** Logotipo horizontal, branco — funciona sobre o azul e sobre o espaço. */
  lockup: asset("/orbita/brand/orbita-lockup.webp"),
  lockupRatio: 987 / 220,

  /** Só o arco, na cor da marca. */
  arc: asset("/orbita/brand/orbita-arc.webp"),
  /** O mesmo arco em branco, para a cortina azul. */
  arcWhite: asset("/orbita/brand/orbita-arc-white.webp"),
  /** O símbolo completo, exatamente como veio (arco + esfera). */
  symbol: asset("/orbita/brand/orbita-symbol.webp"),
} as const;

/** Proporções medidas no símbolo oficial, em frações do raio externo do arco. */
export const SYMBOL = {
  /** Raio interno do arco: a espessura do traço é a diferença para 1. */
  innerRatio: 723.8 / 907.6,
  /** Onde a esfera fica: distância do centro e raio. */
  sphereDistance: 0.891,
  sphereRadius: 0.328,
  /** Ângulo da esfera, medido no arquivo (a boca do arco). */
  sphereAngle: (52.2 * Math.PI) / 180,
  /** O branco exato do arquivo — nem #fff, nem #f8f8f8. */
  white: "#fefefe",
} as const;
