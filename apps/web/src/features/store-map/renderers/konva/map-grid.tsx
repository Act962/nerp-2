"use client";

import { useMemo } from "react";
import { Line, Rect } from "react-konva";

interface MapGridProps {
  widthM: number;
  heightM: number;
  stepM: number;
}

export function MapGrid({ widthM, heightM, stepM }: MapGridProps) {
  const { verticals, horizontals } = useMemo(() => {
    const step = Math.max(stepM, 1);
    const vertical: number[] = [];
    const horizontal: number[] = [];
    for (let x = 0; x <= widthM + 1e-6; x += step) vertical.push(x);
    for (let y = 0; y <= heightM + 1e-6; y += step) horizontal.push(y);
    return { verticals: vertical, horizontals: horizontal };
  }, [widthM, heightM, stepM]);

  return (
    <>
      {verticals.map((x) => (
        <Line
          key={`v-${x}`}
          points={[x, 0, x, heightM]}
          stroke="#e2e8f0"
          strokeWidth={1}
          strokeScaleEnabled={false}
          listening={false}
        />
      ))}
      {horizontals.map((y) => (
        <Line
          key={`h-${y}`}
          points={[0, y, widthM, y]}
          stroke="#e2e8f0"
          strokeWidth={1}
          strokeScaleEnabled={false}
          listening={false}
        />
      ))}
      <Rect
        x={0}
        y={0}
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
