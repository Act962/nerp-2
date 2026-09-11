import type { CardLayoutElement, LayerRect } from "./types";

/**
 * A etiqueta e o grupo que todo catálogo novo recebe.
 *
 * Saiu do "Promoção Lavanderia", desenhado à mão no editor: foto da garrafa à
 * esquerda ocupando quase toda a altura do card, um retângulo branco atrás do
 * texto, nome centralizado em cima e o preço em azul da ÓRBITA, com os centavos
 * menores e o "UND" ao lado. É o mesmo raciocínio do fundo padrão — catálogo
 * novo nasce parecido com um encarte, e não com uma grade crua.
 *
 * **As coordenadas dos elementos são FRAÇÕES do card** (0 a 1), então a
 * etiqueta acompanha qualquer tamanho de card sem redesenho.
 *
 * **As do grupo NÃO são.** `GRUPO_PADRAO` está em pixels da página, no espaço
 * 1080×1440 — a página 3:4 que virou padrão junto com o fundo. Se um dia o
 * padrão deixar de ser 3:4, estes quatro números saem do lugar e precisam ser
 * recalculados; é por isso que eles moram aqui, ao lado deste aviso, e não
 * soltos no meio do `DEFAULT_CONFIG`.
 *
 * Os `id` são fixos de propósito. Eles são a chave dos elementos na tela e o
 * alvo de `cardLayoutOverrides` (etiqueta diferente para um produto só):
 * sortear um id novo a cada catálogo quebraria qualquer override que viesse
 * de um padrão salvo.
 */

/** Proporção do card (largura ÷ altura) que a etiqueta foi desenhada para. */
export const PROPORCAO_DO_CARD_PADRAO = 1.181442244320452;

/** Onde a grade de produtos fica na página, em px de uma página 1080×1440. */
export const GRUPO_PADRAO: LayerRect = { x: 50, y: 338, w: 758, h: 632 };

/** Ampliação dos cards dentro do grupo. */
export const ESCALA_DO_GRUPO_PADRAO = 1.26;

export const ETIQUETA_PADRAO: CardLayoutElement[] = [
  {
    id: "429984f9-f216-4a88-90f9-dbc382fd7ea9",
    kind: "var",
    variable: "photo",
    x: 0.05287695186459057,
    y: 0.102193318631697,
    w: 0.4242559124614102,
    h: 0.8185863889398548,
    z: 0,
    rotation: 0,
    opacity: 1,
    align: "left",
    color: "#111111",
    fill: "#dc2626",
    fontFrac: 0.08,
    fontWeight: 700,
  },
  {
    // Atrás de tudo (z: -1): é a chapa branca que dá contraste ao texto sobre
    // o fundo escuro da arte.
    id: "128a6f06-0570-46a4-99ef-b777a6b8337f",
    kind: "shape",
    shape: "rect",
    x: 0.2619315909546902,
    y: 0.1405989353318679,
    w: 0.714985015616675,
    h: 0.706158247091796,
    z: -1,
    rotation: 0,
    opacity: 1,
    align: "left",
    color: "#111111",
    fill: "#ffffff",
    radius: 0.06,
    fontFrac: 0.09,
    fontWeight: 700,
  },
  {
    id: "09833e33-2afb-4dbc-8544-113e014cac1a",
    kind: "var",
    variable: "name",
    x: 0.4745516951437799,
    y: 0.1280973262746295,
    w: 0.4920792610035184,
    h: 0.3342844765858275,
    z: 1,
    rotation: 0,
    opacity: 1,
    align: "center",
    color: "#111111",
    fill: "#dc2626",
    fontFrac: 0.08,
    fontWeight: 600,
  },
  {
    id: "aa5f65cc-b0ba-4121-ba33-05ff75eb23d9",
    kind: "var",
    variable: "priceReais",
    x: 0.4026548826245799,
    y: 0.4854325254981502,
    w: 0.2986988231912315,
    h: 0.2907690871075099,
    z: 2,
    rotation: 0,
    opacity: 1,
    align: "right",
    color: "#0676b7",
    fill: "#dc2626",
    fontFrac: 0.34,
    fontWeight: 800,
  },
  {
    id: "c659e7a4-87c6-4a37-b852-30f2d2c88a4d",
    kind: "var",
    variable: "priceCents",
    x: 0.6889082502522115,
    y: 0.467680650900572,
    w: 0.24785149224007,
    h: 0.2134171520321102,
    z: 2,
    rotation: 0,
    opacity: 1,
    align: "left",
    color: "#0676b7",
    fill: "#dc2626",
    fontFrac: 0.17,
    fontWeight: 800,
  },
  {
    id: "ef25816f-2a96-41e9-b4c7-5beb2a27d1df",
    kind: "text",
    text: "UND",
    x: 0.7438659507584867,
    y: 0.6499234863575805,
    w: 0.1601572522682249,
    h: 0.1135970863761691,
    z: 2,
    rotation: 0,
    opacity: 1,
    align: "center",
    color: "#111111",
    fill: "#dc2626",
    fontFrac: 0.07,
    fontWeight: 700,
  },
];
