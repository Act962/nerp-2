// Encaixe da foto do produto dentro da caixa física em milímetro.
//
// A proporção do PIXEL de uma foto de catálogo é independente da proporção
// FÍSICA do produto — a foto é tirada de qualquer distância, com qualquer
// enquadramento. Esticar a imagem até a caixa em mm deforma; normalizar o
// arquivo para a proporção física faz o produto flutuar, porque padding
// centralizado é sempre simétrico. A saída é derivar a caixa de desenho da
// razão do bitmap e assentar no piso da prateleira.

export interface ImageFit {
  drawWidthMm: number;
  drawHeightMm: number;
  /** Deslocamento horizontal para centrar na frente do produto. */
  offsetXMm: number;
}

/**
 * Maior retângulo com a proporção do bitmap que cabe na frente do produto,
 * centrado na largura e ancorado no piso (quem ancora é o chamador, usando
 * `drawHeightMm` a partir da base da prateleira).
 *
 * Dimensão de imagem inválida (zero, negativa, NaN — imagem ainda carregando ou
 * quebrada) cai no preenchimento total da caixa: é o comportamento antigo, que
 * ao menos ocupa o espaço certo até a imagem resolver.
 */
export function fitImageToFacing(
  unitWidthMm: number,
  unitHeightMm: number,
  imageWidthPx: number,
  imageHeightPx: number,
): ImageFit {
  const hasUsableImage =
    Number.isFinite(imageWidthPx) &&
    Number.isFinite(imageHeightPx) &&
    imageWidthPx > 0 &&
    imageHeightPx > 0;

  if (!hasUsableImage) {
    return {
      drawWidthMm: unitWidthMm,
      drawHeightMm: unitHeightMm,
      offsetXMm: 0,
    };
  }

  const imageRatio = imageWidthPx / imageHeightPx;
  const drawHeightMm = Math.min(unitHeightMm, unitWidthMm / imageRatio);
  const drawWidthMm = drawHeightMm * imageRatio;

  return {
    drawWidthMm,
    drawHeightMm,
    offsetXMm: (unitWidthMm - drawWidthMm) / 2,
  };
}
