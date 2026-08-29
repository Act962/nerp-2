import sharp from "sharp";
import {
  type BackgroundModel,
  type Rgb,
  backgroundScore,
  buildBackgroundModel,
  rgbToLab,
  whiteBalanceGains,
} from "../lib/image-color";

// Normaliza a foto de um produto: remove o fundo, equaliza e recorta a moldura
// vazia, devolvendo WebP com alpha.
//
// O recorte é o que faz a foto assentar na medida certa da gôndola. Uma foto de
// catálogo costuma vir quadrada com o produto pequeno no meio — o render usa a
// proporção do ARQUIVO, então sem recortar uma garrafa alta desenha como se
// fosse quadrada e sobra vazio na prateleira.
//
// SERVER-ONLY: o sharp não pode ser alcançado pelo bundle do cliente, senão o
// `canvas: false` do next.config para de segurar o Konva e o build quebra.

export type ImageNormalizeStatus = "OK" | "SUSPECT";

export interface NormalizedImage {
  buffer: Buffer;
  widthPx: number;
  heightPx: number;
  status: ImageNormalizeStatus;
  /** Por que virou SUSPECT — some quando status é OK. */
  reason?: string;
  /** Fração da área original que sobrou depois do recorte. */
  areaRatio: number;
  /** Se precisou remover fundo opaco em vez de só recortar o alpha. */
  keyedBackground: boolean;
  /** Se o balanço de branco foi aplicado (só em fundo neutro). */
  whiteBalanced: boolean;
}

/** Espessura da moldura amostrada para modelar o fundo. */
const BORDER_RING_PX = 3;

/** Acima disso o pixel é fundo puro; abaixo do piso é produto. */
const SCORE_OPAQUE = 0.75;
const SCORE_FLOOR = 0.35;

/**
 * Degrau de luminância por pixel que interrompe o preenchimento.
 *
 * É a única coisa que separa embalagem BRANCA de fundo BRANCO: nesse caso
 * croma e luminância praticamente coincidem, e só a borda denuncia onde o
 * produto começa. Sombra não cria degrau — ela cai devagar ao longo de muitos
 * pixels —, então o preenchimento atravessa a sombra e para no contorno.
 */
const EDGE_GRADIENT = 5;

const MIN_AREA_RATIO = 0.02;
const MAX_AREA_RATIO = 0.995;

function luminanceOf(data: Buffer, index: number): number {
  const offset = index * 4;
  return (
    0.2126 * data[offset] +
    0.7152 * data[offset + 1] +
    0.0722 * data[offset + 2]
  );
}

/** Maior degrau até o vizinho da direita e o de baixo. */
function buildGradient(
  data: Buffer,
  width: number,
  height: number,
): Float32Array {
  const luma = new Float32Array(width * height);
  for (let i = 0; i < luma.length; i++) luma[i] = luminanceOf(data, i);

  const gradient = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const right = x < width - 1 ? Math.abs(luma[i] - luma[i + 1]) : 0;
      const down = y < height - 1 ? Math.abs(luma[i] - luma[i + width]) : 0;
      gradient[i] = Math.max(right, down);
    }
  }
  return gradient;
}

function sampleBorder(data: Buffer, width: number, height: number): Rgb[] {
  const samples: Rgb[] = [];
  const push = (index: number) => {
    const offset = index * 4;
    samples.push([data[offset], data[offset + 1], data[offset + 2]]);
  };
  const ring = Math.min(
    BORDER_RING_PX,
    Math.floor(Math.min(width, height) / 4),
  );

  for (let r = 0; r < ring; r++) {
    for (let x = 0; x < width; x++) {
      push(r * width + x);
      push((height - 1 - r) * width + x);
    }
    for (let y = 0; y < height; y++) {
      push(y * width + r);
      push(y * width + (width - 1 - r));
    }
  }
  return samples;
}

/**
 * Torna transparente o fundo CONECTADO ÀS BORDAS, sem atravessar contorno.
 *
 * Preenchimento por inundação a partir da moldura, não limiar global: um rótulo
 * branco no meio da embalagem tem a mesma cor do fundo branco, e um limiar
 * global abriria buracos dentro do produto. Só é fundo o que se alcança vindo
 * de fora — e o degrau de borda impede que "vindo de fora" invada uma
 * embalagem cuja cor coincide com a do fundo.
 */
function keyOutBackground(
  data: Buffer,
  width: number,
  height: number,
  model: BackgroundModel,
  gradient: Float32Array,
): void {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const scoreAt = (index: number): number => {
    const offset = index * 4;
    return backgroundScore(
      rgbToLab([data[offset], data[offset + 1], data[offset + 2]]),
      model,
    );
  };

  const consider = (index: number) => {
    if (visited[index]) return;
    visited[index] = 1;
    if (scoreAt(index) < SCORE_FLOOR) return;
    // Contorno: não propaga para além dele, mas o próprio pixel de borda
    // continua elegível a virar semitransparente na banda suave.
    if (gradient[index] > EDGE_GRADIENT) return;
    queue[tail++] = index;
  };

  for (let x = 0; x < width; x++) {
    consider(x);
    consider((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    consider(y * width);
    consider(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = (index - x) / width;

    const score = scoreAt(index);
    const offset = index * 4;
    if (score >= SCORE_OPAQUE) {
      data[offset + 3] = 0;
    } else {
      // Banda suave: evita serrilha no contorno do recorte.
      const t = (score - SCORE_FLOOR) / (SCORE_OPAQUE - SCORE_FLOOR);
      data[offset + 3] = Math.round(data[offset + 3] * (1 - t));
    }

    if (x > 0) consider(index - 1);
    if (x < width - 1) consider(index + 1);
    if (y > 0) consider(index - width);
    if (y < height - 1) consider(index + width);
  }
}

export async function normalizeProductImage(
  input: Buffer,
): Promise<NormalizedImage> {
  const source = sharp(input).ensureAlpha();
  const { data, info } = await source
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const originalArea = width * height;

  const samples = sampleBorder(data, width, height);
  const alreadyTransparent = [
    0,
    width - 1,
    (height - 1) * width,
    (height - 1) * width + width - 1,
  ].every((index) => data[index * 4 + 3] === 0);

  let keyedBackground = false;
  let whiteBalanced = false;

  if (!alreadyTransparent) {
    const model = buildBackgroundModel(samples);

    if (!model.uniform) {
      // Fundo com cores demais (foto na gôndola, cenário, degradê forte).
      // Recortar aqui comeria o produto — melhor devolver intacto e sinalizar.
      const untouched = await sharp(input).webp({ quality: 90 }).toBuffer();
      return {
        buffer: untouched,
        widthPx: width,
        heightPx: height,
        status: "SUSPECT",
        reason: "fundo não uniforme — a moldura da foto tem cores demais",
        areaRatio: 1,
        keyedBackground: false,
        whiteBalanced: false,
      };
    }

    // Balanço de branco ANTES do recorte, usando o fundo como referência.
    // Devolve null em fundo colorido — corrigir por ele arrancaria a cor do
    // encarte e jogaria a dominante inversa no produto.
    const mean = samples
      .reduce<Rgb>(
        (acc, [r, g, b]) => [acc[0] + r, acc[1] + g, acc[2] + b],
        [0, 0, 0],
      )
      .map((sum) => sum / samples.length) as Rgb;
    const gains = whiteBalanceGains(model, mean);
    if (gains) {
      for (let i = 0; i < width * height; i++) {
        const offset = i * 4;
        for (let c = 0; c < 3; c++) {
          data[offset + c] = Math.max(
            0,
            Math.min(255, Math.round(data[offset + c] * gains[c])),
          );
        }
      }
      whiteBalanced = true;
    }

    const gradient = buildGradient(data, width, height);
    keyOutBackground(data, width, height, model, gradient);
    keyedBackground = true;
  }

  const keyed = sharp(data, { raw: { width, height, channels: 4 } });
  const trimmed = await keyed
    .trim({ threshold: 1 })
    .webp({ quality: 90 })
    .toBuffer();
  const trimmedMeta = await sharp(trimmed).metadata();

  const trimmedWidth = trimmedMeta.width ?? width;
  const trimmedHeight = trimmedMeta.height ?? height;
  const areaRatio = (trimmedWidth * trimmedHeight) / originalArea;

  if (areaRatio < MIN_AREA_RATIO || areaRatio > MAX_AREA_RATIO) {
    return {
      buffer: trimmed,
      widthPx: trimmedWidth,
      heightPx: trimmedHeight,
      status: "SUSPECT",
      reason:
        areaRatio < MIN_AREA_RATIO
          ? `recorte sobrou só ${(areaRatio * 100).toFixed(1)}% da imagem`
          : "nada foi recortado — a foto pode não ter moldura vazia",
      areaRatio,
      keyedBackground,
      whiteBalanced,
    };
  }

  return {
    buffer: trimmed,
    widthPx: trimmedWidth,
    heightPx: trimmedHeight,
    status: "OK",
    areaRatio,
    keyedBackground,
    whiteBalanced,
  };
}
