/**
 * Matemática de cor da normalização de foto de produto. Puro: sem sharp, sem
 * I/O — é aqui que mora a decisão do que é fundo, do que é sombra e do que é
 * embalagem, e é isto que dá para testar sem imagem de verdade.
 *
 * Trabalhamos em CIELAB de propósito. Em RGB, "cinza claro" e "branco sujo"
 * ficam longe um do outro por causa da luminância, e uma sombra sobre fundo
 * branco vira uma cor completamente diferente. Em LAB a sombra mantém o
 * croma (a,b) e só derruba o L — o que permite tratá-la como fundo sem abrir
 * a tolerância para cima e passar a comer o produto.
 */

export type Rgb = [number, number, number];
export type Lab = [number, number, number];

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

// D65
const WHITE_X = 0.95047;
const WHITE_Y = 1;
const WHITE_Z = 1.08883;

function pivot(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

export function rgbToLab([r, g, b]: Rgb): Lab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / WHITE_X;
  const y = (lr * 0.2126 + lg * 0.7152 + lb * 0.0722) / WHITE_Y;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / WHITE_Z;

  const fx = pivot(x);
  const fy = pivot(y);
  const fz = pivot(z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Distância só no plano de croma (a,b) — ignora luminância de propósito. */
export function chromaDistance(a: Lab, b: Lab): number {
  return Math.hypot(a[1] - b[1], a[2] - b[2]);
}

export interface BackgroundModel {
  /** Croma central do fundo. */
  a: number;
  b: number;
  /** Espalhamento de croma observado na moldura. */
  chromaSpread: number;
  /** Faixa de luminância observada na moldura. */
  lMin: number;
  lMax: number;
  /** Fundo praticamente sem cor — só então o balanço de branco é seguro. */
  neutral: boolean;
  /** Moldura homogênea o bastante para confiar no recorte. */
  uniform: boolean;
}

/** Sombra só ESCURECE. A janela de luminância abre para baixo, não para cima. */
const SHADOW_DROP = 34;
const HIGHLIGHT_RISE = 8;
/** Acima disso a moldura tem cores demais para ser fundo de estúdio. */
const MAX_CHROMA_SPREAD = 18;
const MAX_LUMINANCE_SPREAD = 46;
/** |a| e |b| abaixo disso: fundo cinza/branco, sem tonalidade própria. */
const NEUTRAL_CHROMA = 6;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((sorted.length - 1) * p)),
  );
  return sorted[index];
}

/**
 * Modela o fundo a partir da MOLDURA INTEIRA, não de um canto.
 *
 * Um canto só não enxerga degradê, vinheta nem sombra de um lado. Amostrar a
 * borda toda e guardar a faixa observada é o que permite aceitar foto de
 * encarte com fundo levemente irregular em vez de recusá-la inteira.
 */
export function buildBackgroundModel(samples: Rgb[]): BackgroundModel {
  if (samples.length === 0) {
    return {
      a: 0,
      b: 0,
      chromaSpread: 0,
      lMin: 0,
      lMax: 0,
      neutral: false,
      uniform: false,
    };
  }

  const labs = samples.map(rgbToLab);
  const aMean = labs.reduce((sum, lab) => sum + lab[1], 0) / labs.length;
  const bMean = labs.reduce((sum, lab) => sum + lab[2], 0) / labs.length;

  const chromaSorted = labs
    .map((lab) => Math.hypot(lab[1] - aMean, lab[2] - bMean))
    .sort((x, y) => x - y);
  const lSorted = labs.map((lab) => lab[0]).sort((x, y) => x - y);

  // Percentis, não mínimo/máximo: um pixel de produto encostando na borda não
  // pode esticar o modelo e transformar o produto inteiro em fundo.
  const chromaSpread = percentile(chromaSorted, 0.9);
  const lMin = percentile(lSorted, 0.05);
  const lMax = percentile(lSorted, 0.95);

  return {
    a: aMean,
    b: bMean,
    chromaSpread,
    lMin,
    lMax,
    neutral:
      Math.abs(aMean) <= NEUTRAL_CHROMA && Math.abs(bMean) <= NEUTRAL_CHROMA,
    uniform:
      chromaSpread <= MAX_CHROMA_SPREAD && lMax - lMin <= MAX_LUMINANCE_SPREAD,
  };
}

/**
 * Quanto o pixel se parece com fundo: 1 é fundo certo, 0 é produto certo.
 *
 * Croma manda. A luminância só reprova quando o pixel é mais CLARO que a
 * moldura ou escuro além do que uma sombra explicaria — assim uma sombra
 * projetada continua sendo fundo, e um branco de embalagem mais brilhante que
 * o fundo não é.
 */
export function backgroundScore(lab: Lab, model: BackgroundModel): number {
  const chroma = Math.hypot(lab[1] - model.a, lab[2] - model.b);
  const chromaLimit = Math.max(6, model.chromaSpread) + 6;
  if (chroma > chromaLimit * 2) return 0;

  const floor = model.lMin - SHADOW_DROP;
  const ceiling = model.lMax + HIGHLIGHT_RISE;
  if (lab[0] < floor || lab[0] > ceiling) return 0;

  // Dentro da faixa: o quanto o croma se afasta é o que decide, com uma banda
  // suave no meio para a borda do recorte não sair serrilhada.
  const t = chroma / (chromaLimit * 2);
  return Math.max(0, Math.min(1, 1 - t));
}

/**
 * Ganhos por canal para neutralizar a dominante de cor, usando o fundo como
 * referência de branco.
 *
 * Devolve `null` quando o fundo NÃO é neutro: em encarte de fundo colorido,
 * corrigir por ele arrancaria a cor do fundo e jogaria a dominante inversa em
 * cima do produto. Sem referência confiável, é melhor não mexer.
 */
export function whiteBalanceGains(
  model: BackgroundModel,
  backgroundRgb: Rgb,
): [number, number, number] | null {
  if (!model.neutral) return null;
  const [r, g, b] = backgroundRgb;
  const mean = (r + g + b) / 3;
  if (mean <= 1) return null;

  const gains: [number, number, number] = [mean / r, mean / g, mean / b];
  // Correção violenta indica que o fundo não era neutro de verdade.
  if (
    gains.some((gain) => !Number.isFinite(gain) || gain < 0.7 || gain > 1.4)
  ) {
    return null;
  }
  return gains;
}
