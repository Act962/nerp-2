"use client";

import { useMemo } from "react";
import { Line, Rect } from "react-konva";

interface MapGridProps {
  widthM: number;
  heightM: number;
  stepM: number;
  /** Canto superior esquerdo do footprint da planta, em metros (default 0,0). */
  originX?: number;
  originY?: number;
}

export function MapGrid({
  widthM,
  heightM,
  stepM,
  originX = 0,
  originY = 0,
}: MapGridProps) {
  const { verticals, horizontals } = useMemo(() => {
    const step = Math.max(stepM, 1);
    const vertical: number[] = [];
    const horizontal: number[] = [];
    // As linhas seguem a grade do mundo (múltiplos de step) mas ficam contidas
    // no footprint da planta — o fundo tem o mesmo tamanho da planta.
    const startX = Math.ceil(originX / step) * step;
    const startY = Math.ceil(originY / step) * step;
    for (let x = startX; x <= originX + widthM + 1e-6; x += step)
      vertical.push(x);
    for (let y = startY; y <= originY + heightM + 1e-6; y += step)
      horizontal.push(y);
    return { verticals: vertical, horizontals: horizontal };
  }, [widthM, heightM, stepM, originX, originY]);

  const right = originX + widthM;
  const bottom = originY + heightM;

  return (
    <>
      {verticals.map((x) => (
        <Line
          key={`v-${x}`}
          points={[x, originY, x, bottom]}
          stroke="#e2e8f0"
          strokeWidth={1}
          strokeScaleEnabled={false}
          listening={false}
        />
      ))}
      {horizontals.map((y) => (
        <Line
          key={`h-${y}`}
          points={[originX, y, right, y]}
          stroke="#e2e8f0"
          strokeWidth={1}
          strokeScaleEnabled={false}
          listening={false}
        />
      ))}
      <Rect
        x={originX}
        y={originY}
        width={widthM}
        height={heightM}
        stroke="#94a3b8"
        strokeWidth={1.5}
        strokeScaleEnabled={false}
        listening={false}
      />
    </>
  );
}
