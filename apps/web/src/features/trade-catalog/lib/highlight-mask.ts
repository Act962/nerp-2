export interface Vec2 {
  x: number;
  y: number;
}

const MAX_DIMENSION = 2000;

// Marca d'água: o logo do Órbita repetido na diagonal. Tiling (em vez de
// esticar um PNG de quadro inteiro) mantém o logo sem distorção em qualquer
// proporção de foto e cobre a imagem toda, dificultando recorte/reuso.
const WATERMARK_OPACITY = 0.14;
const WATERMARK_ANGLE = -Math.PI / 6;
// Largura do logo como fração da largura da imagem.
const WATERMARK_TILE_RATIO = 0.28;
const WATERMARK_GAP_X = 1.7;
const WATERMARK_GAP_Y = 3.4;

function drawWatermarkTiles(
  context: CanvasRenderingContext2D,
  watermark: HTMLImageElement,
  width: number,
  height: number,
): void {
  const tileWidth = width * WATERMARK_TILE_RATIO;
  const tileHeight = tileWidth * (watermark.height / watermark.width);
  const stepX = tileWidth * WATERMARK_GAP_X;
  const stepY = tileHeight * WATERMARK_GAP_Y;
  // Rotacionar reduz a área útil, então varre além da diagonal pra cobrir tudo.
  const reach = Math.hypot(width, height);

  context.save();
  context.globalAlpha = WATERMARK_OPACITY;
  context.translate(width / 2, height / 2);
  context.rotate(WATERMARK_ANGLE);

  for (let y = -reach; y < reach; y += stepY) {
    for (let x = -reach; x < reach; x += stepX) {
      context.drawImage(watermark, x, y, tileWidth, tileHeight);
    }
  }

  context.restore();
}

// Compõe a "foto modelo": quando há polígono (≥3 pontos), apaga a imagem inteira
// pra dimOpacity e reacende só a região traçada; sem polígono, mantém a imagem
// cheia. Por último aplica a marca d'água do Órbita (se carregada). Pontos vêm
// NORMALIZADOS [0..1] relativos ao tamanho natural, então o traçado do preview
// escalado casa com o export nativo. Escala o lado maior pra MAX_DIMENSION pra
// não gerar PNG gigante.
export async function composeHighlight(
  image: HTMLImageElement,
  points: Vec2[],
  dimOpacity: number,
  watermark?: HTMLImageElement | null,
): Promise<Blob> {
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(naturalWidth, naturalHeight),
  );
  const width = Math.round(naturalWidth * scale);
  const height = Math.round(naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D não disponível");

  const hasHighlight = points.length >= 3;

  context.globalAlpha = hasHighlight ? dimOpacity : 1;
  context.drawImage(image, 0, 0, width, height);

  if (hasHighlight) {
    context.globalAlpha = 1;
    context.save();
    context.beginPath();
    points.forEach((point, index) => {
      const x = point.x * width;
      const y = point.y * height;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
    context.clip();
    context.drawImage(image, 0, 0, width, height);
    context.restore();
  }

  if (watermark) {
    drawWatermarkTiles(context, watermark, width, height);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Falha ao gerar a imagem")),
      "image/png",
    );
  });
}
