import type { Bounds, Geometry, MapShapeKind, Vec2, Viewport } from "./types";

/** Converte um ponto do mundo (metros) para coordenadas de tela (px). */
export function worldToScreen(
  point: Vec2,
  viewport: Viewport,
  pixelsPerMeter: number,
): Vec2 {
  const scale = viewport.zoom * pixelsPerMeter;
  return {
    x: point.x * scale + viewport.x,
    y: point.y * scale + viewport.y,
  };
}

/** Converte um ponto de tela (px) para coordenadas do mundo (metros). */
export function screenToWorld(
  point: Vec2,
  viewport: Viewport,
  pixelsPerMeter: number,
): Vec2 {
  const scale = viewport.zoom * pixelsPerMeter;
  return {
    x: (point.x - viewport.x) / scale,
    y: (point.y - viewport.y) / scale,
  };
}

export function boundsOf(geometry: Geometry): Bounds {
  switch (geometry.kind) {
    case "RECT": {
      // Considera rotação projetando os quatro cantos.
      const { x, y, width, height, rotation } = geometry;
      const cx = x + width / 2;
      const cy = y + height / 2;
      const rad = (rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const corners: Vec2[] = [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ].map((corner) => {
        const dx = corner.x - cx;
        const dy = corner.y - cy;
        return {
          x: cx + dx * cos - dy * sin,
          y: cy + dx * sin + dy * cos,
        };
      });
      return boundsOfPoints(corners);
    }
    case "POLYGON":
    case "POLYLINE":
      return boundsOfPoints(geometry.points);
    case "POINT":
      return {
        minX: geometry.x,
        minY: geometry.y,
        maxX: geometry.x,
        maxY: geometry.y,
      };
  }
}

export function boundsOfPoints(points: Vec2[]): Bounds {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Área real em m². Não usar `boundsOf` para isso — ele projeta os cantos
 * rotacionados e devolve a AABB (uma gôndola 4×1 girada 45° reportaria
 * ~12,5 m² em vez de 4). RECT usa w×h direto (rotação não muda área);
 * POLYGON usa a fórmula do shoelace; POLYLINE/POINT não têm área.
 */
export function areaOf(geometry: Geometry): number {
  switch (geometry.kind) {
    case "RECT":
      return Math.abs(geometry.width * geometry.height);
    case "POLYGON":
      return shoelaceArea(geometry.points);
    case "POLYLINE":
    case "POINT":
      return 0;
  }
}

function shoelaceArea(points: Vec2[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

export function unionBounds(a: Bounds, b: Bounds): Bounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return (
    a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
  );
}

/** Área visível do mundo (metros) a partir do tamanho da tela e do viewport. */
export function visibleWorldBounds(
  screenWidth: number,
  screenHeight: number,
  viewport: Viewport,
  pixelsPerMeter: number,
): Bounds {
  const topLeft = screenToWorld({ x: 0, y: 0 }, viewport, pixelsPerMeter);
  const bottomRight = screenToWorld(
    { x: screenWidth, y: screenHeight },
    viewport,
    pixelsPerMeter,
  );
  return {
    minX: topLeft.x,
    minY: topLeft.y,
    maxX: bottomRight.x,
    maxY: bottomRight.y,
  };
}

export function translateGeometry(
  geometry: Geometry,
  dx: number,
  dy: number,
): Geometry {
  switch (geometry.kind) {
    case "RECT":
      return { ...geometry, x: geometry.x + dx, y: geometry.y + dy };
    case "POINT":
      return { ...geometry, x: geometry.x + dx, y: geometry.y + dy };
    case "POLYGON":
    case "POLYLINE":
      return {
        ...geometry,
        points: geometry.points.map((point) => ({
          x: point.x + dx,
          y: point.y + dy,
        })),
      };
  }
}

/** Geometria inicial ao criar um objeto de determinado tipo de forma. */
export function defaultGeometryFor(
  shapeKind: MapShapeKind,
  origin: Vec2,
): Geometry {
  switch (shapeKind) {
    case "RECT":
      return {
        kind: "RECT",
        x: origin.x,
        y: origin.y,
        width: 1,
        height: 1,
        rotation: 0,
      };
    case "POLYLINE":
      return { kind: "POLYLINE", points: [origin] };
    case "POLYGON":
      return { kind: "POLYGON", points: [origin] };
    case "POINT":
      return { kind: "POINT", x: origin.x, y: origin.y };
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Arredonda uma coordenada em metros ao passo do grid (para snapping). */
export function snapToGrid(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

export interface DragSnapResult {
  dx: number;
  dy: number;
  guidesX: number[];
  guidesY: number[];
}

/**
 * Snapping ao arrastar: alinha bordas/centro do objeto às bordas/centro dos
 * demais (guias de alinhamento). Sem alinhamento no eixo, cai no grid quando
 * ativo. Distâncias em metros; `threshold` já convertido de px.
 */
export function alignmentSnap(
  drag: Bounds,
  others: Bounds[],
  threshold: number,
  gridStep: number,
  snapEnabled: boolean,
): DragSnapResult {
  const anchorsX = [drag.minX, (drag.minX + drag.maxX) / 2, drag.maxX];
  const anchorsY = [drag.minY, (drag.minY + drag.maxY) / 2, drag.maxY];

  const targetsX: number[] = [];
  const targetsY: number[] = [];
  for (const bounds of others) {
    targetsX.push(bounds.minX, (bounds.minX + bounds.maxX) / 2, bounds.maxX);
    targetsY.push(bounds.minY, (bounds.minY + bounds.maxY) / 2, bounds.maxY);
  }

  const best = (anchors: number[], targets: number[]) => {
    let bestDiff = threshold;
    let snap: { delta: number; line: number } | null = null;
    for (const anchor of anchors) {
      for (const target of targets) {
        const diff = Math.abs(anchor - target);
        if (diff <= bestDiff) {
          bestDiff = diff;
          snap = { delta: target - anchor, line: target };
        }
      }
    }
    return snap;
  };

  const snapX = best(anchorsX, targetsX);
  const snapY = best(anchorsY, targetsY);

  const guidesX: number[] = [];
  let dx = 0;
  if (snapX) {
    dx = snapX.delta;
    guidesX.push(snapX.line);
  } else if (snapEnabled) {
    dx = snapToGrid(drag.minX, gridStep) - drag.minX;
  }

  const guidesY: number[] = [];
  let dy = 0;
  if (snapY) {
    dy = snapY.delta;
    guidesY.push(snapY.line);
  } else if (snapEnabled) {
    dy = snapToGrid(drag.minY, gridStep) - drag.minY;
  }

  return { dx, dy, guidesX, guidesY };
}

const NICE_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];

/** Passo "redondo" em metros para a régua, dado quantos px cada metro ocupa. */
export function niceStep(pixelsPerMeter: number, minPx = 64): number {
  for (const step of NICE_STEPS) {
    if (step * pixelsPerMeter >= minPx) return step;
  }
  return NICE_STEPS[NICE_STEPS.length - 1];
}

/** Valores de mundo (metros) múltiplos de `step` dentro de [min, max]. */
export function ticksInRange(min: number, max: number, step: number): number[] {
  if (step <= 0) return [];
  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let value = start; value <= max; value += step) {
    ticks.push(Math.round(value / step) * step);
  }
  return ticks;
}
