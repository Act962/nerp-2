import sharp from "sharp";

// Normaliza a foto de um produto para o planograma: remove o fundo (quando é
// uniforme), recorta a moldura vazia e devolve WebP com alpha.
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
}

/** Distância de cor até o fundo abaixo da qual o pixel é considerado fundo. */
const BACKGROUND_TOLERANCE = 42;
/** Acima disso o pixel é produto; entre as duas faixas o alpha é proporcional. */
const EDGE_TOLERANCE = 78;

/** Fundo uniforme o bastante para keying: os 4 cantos precisam concordar. */
const CORNER_AGREEMENT = 30;

/** Recorte que sobrou quase nada (ou quase tudo) não é recorte confiável. */
const MIN_AREA_RATIO = 0.02;
const MAX_AREA_RATIO = 0.995;

type Rgb = [number, number, number];

function colorDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2,
  );
}

/**
 * Torna transparente o fundo CONECTADO ÀS BORDAS.
 *
 * Preenchimento por inundação a partir da moldura, não limiar global: um rótulo
 * branco no meio da embalagem tem a mesma cor do fundo branco, e um limiar
 * global abriria buracos dentro do produto. Só é fundo o que se alcança vindo
 * de fora.
 */
function keyOutBackground(
  data: Buffer,
  width: number,
  height: number,
  background: Rgb,
): void {
  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  function pixelColor(index: number): Rgb {
    const offset = index * 4;
    return [data[offset], data[offset + 1], data[offset + 2]];
  }

  function enqueueIfBackground(index: number) {
    if (visited[index]) return;
    visited[index] = 1;
    if (colorDistance(pixelColor(index), background) <= EDGE_TOLERANCE) {
      queue[tail++] = index;
    }
  }

  for (let x = 0; x < width; x++) {
    enqueueIfBackground(x);
    enqueueIfBackground((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    enqueueIfBackground(y * width);
    enqueueIfBackground(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const distance = colorDistance(pixelColor(index), background);
    const offset = index * 4;

    if (distance <= BACKGROUND_TOLERANCE) {
      data[offset + 3] = 0;
    } else {
      // Faixa de transição: alpha proporcional, para a borda do produto não
      // ficar serrilhada nem deixar auréola clara.
      const ratio =
        (distance - BACKGROUND_TOLERANCE) /
        (EDGE_TOLERANCE - BACKGROUND_TOLERANCE);
      data[offset + 3] = Math.round(data[offset + 3] * ratio);
      continue; // borda não propaga: o produto começa aqui
    }

    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) enqueueIfBackground(index - 1);
    if (x < width - 1) enqueueIfBackground(index + 1);
    if (y > 0) enqueueIfBackground(index - width);
    if (y < height - 1) enqueueIfBackground(index + width);
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

  const cornerIndexes = [
    0,
    width - 1,
    (height - 1) * width,
    (height - 1) * width + width - 1,
  ];
  const corners = cornerIndexes.map((index): [Rgb, number] => {
    const offset = index * 4;
    return [
      [data[offset], data[offset + 1], data[offset + 2]],
      data[offset + 3],
    ];
  });

  const isAlreadyTransparent = corners.every(([, alpha]) => alpha === 0);
  let keyedBackground = false;

  if (!isAlreadyTransparent) {
    const [firstCorner] = corners[0];
    const cornersAgree = corners.every(
      ([color]) => colorDistance(color, firstCorner) <= CORNER_AGREEMENT,
    );

    if (!cornersAgree) {
      // Fundo não uniforme (foto tirada na gôndola, cenário, degradê forte).
      // Recortar aqui comeria o produto — melhor devolver intacto e sinalizar.
      const untouched = await sharp(input).webp({ quality: 90 }).toBuffer();
      return {
        buffer: untouched,
        widthPx: width,
        heightPx: height,
        status: "SUSPECT",
        reason: "fundo não uniforme — os cantos da foto têm cores diferentes",
        areaRatio: 1,
        keyedBackground: false,
      };
    }

    keyOutBackground(data, width, height, firstCorner);
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
    };
  }

  return {
    buffer: trimmed,
    widthPx: trimmedWidth,
    heightPx: trimmedHeight,
    status: "OK",
    areaRatio,
    keyedBackground,
  };
}
