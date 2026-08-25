import "server-only";

import sharp from "sharp";
import { computeCropRect, type PhotoAdjustment } from "../lib/photo-adjustment";

// Semáforo global de processamento de imagem: um book grande (centenas de
// fotos) processadas todas em paralelo estouraria memória/soquetes. Limita
// quantos fetch+sharp rodam ao mesmo tempo, sem serializar tudo.
const MAX_CONCURRENT_IMAGE_OPS = 6;
let activeImageOps = 0;
const imageOpQueue: Array<() => void> = [];
async function withImageLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (activeImageOps >= MAX_CONCURRENT_IMAGE_OPS) {
    await new Promise<void>((resolve) => imageOpQueue.push(resolve));
  }
  activeImageOps++;
  try {
    return await fn();
  } finally {
    activeImageOps--;
    imageOpQueue.shift()?.();
  }
}

// Baixa a foto e devolve um JPEG (buffer) já orientado pelo EXIF, com um teto
// de dimensão. Serve pra EMBUTIR toda foto no PDF em vez de deixar o react-pdf
// baixar a URL no render — o react-pdf só decodifica JPEG/PNG e falha calado em
// fetch instável ou formato diferente (webp/heic), o que fazia "sumir" fotos.
export async function reencodeToJpeg(url: string): Promise<Buffer> {
  return withImageLimit(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`fetch ${response.status} em ${url}`);
      }
      const original = Buffer.from(await response.arrayBuffer());
      return await sharp(original)
        .rotate()
        .resize(2600, 2600, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } finally {
      clearTimeout(timeout);
    }
  });
}

// Baixa a foto original e aplica o mesmo corte (pan/zoom) calculado no
// editor, pra render no PDF ficar idêntico ao que o admin ajustou na tela.
export async function cropPhotoForPdf(
  url: string,
  adjustment: PhotoAdjustment,
  targetAspectRatio: number,
): Promise<Buffer> {
  const response = await fetch(url);
  const original = Buffer.from(await response.arrayBuffer());

  // `.rotate()` sem argumentos = auto-orient pelo EXIF, igual ao que o
  // navegador já faz sozinho ao exibir a foto no editor — precisa vir antes
  // de ler width/height, senão o corte usa dimensões pré-rotação e erra.
  const metadata = await sharp(original).rotate().metadata();
  const naturalWidth = metadata.width ?? 1;
  const naturalHeight = metadata.height ?? 1;

  const rect = computeCropRect(
    adjustment,
    targetAspectRatio,
    1,
    naturalWidth,
    naturalHeight,
  );

  return sharp(original)
    .rotate()
    .extract(rect)
    .jpeg({ quality: 90 })
    .toBuffer();
}

// Lê a proporção (largura/altura) de uma foto. Usado pra decidir a orientação
// (horizontal/vertical) no auto-gerador.
export async function readPhotoAspect(url: string): Promise<number | null> {
  try {
    const response = await fetch(url);
    const original = Buffer.from(await response.arrayBuffer());
    const meta = await sharp(original).rotate().metadata();
    if (!meta.width || !meta.height) return null;
    return meta.width / meta.height;
  } catch {
    return null;
  }
}

// Foco seletivo pro PDF: compõe numa imagem só a foto inteira desfocada com o
// polígono nítido (o mesmo que o usuário desenhou) por cima. Feito no sharp
// porque o react-pdf não tem blur nem clip em runtime — o slot recebe uma
// única imagem pronta.
export async function composeFocusPhotoForPdf(
  url: string,
  adjustment: PhotoAdjustment,
  targetAspectRatio: number,
): Promise<Buffer> {
  const response = await fetch(url);
  const original = Buffer.from(await response.arrayBuffer());

  const metadata = await sharp(original).rotate().metadata();
  const rect = computeCropRect(
    adjustment,
    targetAspectRatio,
    1,
    metadata.width ?? 1,
    metadata.height ?? 1,
  );

  const width = 1000;
  const height = Math.max(1, Math.round(width / targetAspectRatio));

  // A foto enquadrada no espaço (mesmo pan/zoom do editor), redimensionada pro
  // canvas de composição.
  const base = await sharp(original)
    .rotate()
    .extract(rect)
    .resize(width, height, { fit: "fill" })
    .toBuffer();

  const blurred = await sharp(base).blur(14).toBuffer();

  const points = adjustment.focusPolygon ?? [];
  // Menos de 3 nós = sem área fechada: sai a foto toda desfocada.
  if (points.length < 3) {
    return sharp(blurred).jpeg({ quality: 88 }).toBuffer();
  }

  // Máscara: polígono branco (nítido) sobre transparente. `dest-in` mantém a
  // foto só dentro do polígono; o resto fica transparente e revela o desfoque.
  const polygon = points
    .map((point) => `${(point.x / 100) * width},${(point.y / 100) * height}`)
    .join(" ");
  const maskSvg = Buffer.from(
    `<svg width="${width}" height="${height}"><polygon points="${polygon}" fill="#fff"/></svg>`,
  );

  const sharpMasked = await sharp(base)
    .composite([{ input: maskSvg, blend: "dest-in" }])
    .png()
    .toBuffer();

  return sharp(blurred)
    .composite([{ input: sharpMasked }])
    .jpeg({ quality: 88 })
    .toBuffer();
}
