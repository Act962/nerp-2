import "server-only";

import sharp from "sharp";
import { computeCropRect, type PhotoAdjustment } from "../lib/photo-adjustment";

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
