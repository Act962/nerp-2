"use client";

import { Group, Image as KonvaImage, Rect } from "react-konva";
import useImage from "use-image";

const BACKGROUND_SRC = "/planogram/editor-background.jpg";

/** Véu branco sobre a foto: sem ele o bokeh compete com as embalagens. */
const VEIL_OPACITY = 0.62;

interface StageBackgroundProps {
  worldWidthMm: number;
  worldHeightMm: number;
}

/**
 * Foto de supermercado atrás da gôndola, para dar contexto de loja ao desenho.
 *
 * Escala em "cover": a imagem cobre o mundo inteiro sem distorcer a proporção —
 * esticar deixaria as luzes do teto ovaladas e denunciaria o truque.
 */
export function StageBackground({
  worldWidthMm,
  worldHeightMm,
}: StageBackgroundProps) {
  const [image] = useImage(BACKGROUND_SRC);

  if (!image) return null;

  const coverScale = Math.max(
    worldWidthMm / image.width,
    worldHeightMm / image.height,
  );
  const drawWidthMm = image.width * coverScale;
  const drawHeightMm = image.height * coverScale;

  return (
    // A Layer está espelhada no eixo Y para medir do piso para cima; sem
    // desespelhar aqui a foto sairia de cabeça para baixo.
    <Group listening={false} y={worldHeightMm} scaleY={-1}>
      <KonvaImage
        image={image}
        x={(worldWidthMm - drawWidthMm) / 2}
        y={(worldHeightMm - drawHeightMm) / 2}
        width={drawWidthMm}
        height={drawHeightMm}
        listening={false}
        perfectDrawEnabled={false}
      />
      <Rect
        x={0}
        y={0}
        width={worldWidthMm}
        height={worldHeightMm}
        fill="#ffffff"
        opacity={VEIL_OPACITY}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}
