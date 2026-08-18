"use client";

import { niceStep, ticksInRange } from "../../engine/geometry";
import { useSceneStore } from "../../engine/scene-store";

const RULER = 20;

function formatTick(value: number, step: number) {
  return step % 1 === 0 ? String(value) : value.toFixed(1);
}

export function MapRulers() {
  const floorPlan = useSceneStore((state) => state.floorPlan);
  const viewport = useSceneStore((state) => state.viewport);
  const { width, height } = useSceneStore((state) => state.stageSize);

  if (!floorPlan || width === 0 || height === 0) return null;

  const scale = viewport.zoom * floorPlan.pixelsPerMeter;
  const step = niceStep(scale);

  const worldMinX = -viewport.x / scale;
  const worldMaxX = (width - viewport.x) / scale;
  const worldMinY = -viewport.y / scale;
  const worldMaxY = (height - viewport.y) / scale;

  const ticksX = ticksInRange(worldMinX, worldMaxX, step);
  const ticksY = ticksInRange(worldMinY, worldMaxY, step);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-muted-foreground">
      <div
        className="absolute left-0 top-0 flex items-center justify-center border-b border-r bg-background/95 text-[9px] font-medium"
        style={{ width: RULER, height: RULER }}
      >
        m
      </div>

      <svg
        className="absolute top-0 bg-background/95"
        style={{ left: RULER, width: width - RULER, height: RULER }}
        role="presentation"
      >
        <line
          x1={0}
          y1={RULER - 0.5}
          x2={width}
          y2={RULER - 0.5}
          stroke="currentColor"
          strokeOpacity={0.2}
        />
        {ticksX.map((value) => {
          const x = value * scale + viewport.x - RULER;
          if (x < 0 || x > width - RULER) return null;
          return (
            <g key={`x-${value}`}>
              <line
                x1={x}
                y1={RULER - 6}
                x2={x}
                y2={RULER}
                stroke="currentColor"
                strokeOpacity={0.4}
              />
              <text x={x + 2} y={11} fontSize={9} fill="currentColor">
                {formatTick(value, step)}
              </text>
            </g>
          );
        })}
      </svg>

      <svg
        className="absolute left-0 bg-background/95"
        style={{ top: RULER, width: RULER, height: height - RULER }}
        role="presentation"
      >
        <line
          x1={RULER - 0.5}
          y1={0}
          x2={RULER - 0.5}
          y2={height}
          stroke="currentColor"
          strokeOpacity={0.2}
        />
        {ticksY.map((value) => {
          const y = value * scale + viewport.y - RULER;
          if (y < 0 || y > height - RULER) return null;
          return (
            <g key={`y-${value}`}>
              <line
                x1={RULER - 6}
                y1={y}
                x2={RULER}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.4}
              />
              <text
                x={RULER - 8}
                y={y - 2}
                fontSize={9}
                fill="currentColor"
                textAnchor="end"
                transform={`rotate(-90 ${RULER - 8} ${y - 2})`}
              >
                {formatTick(value, step)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
