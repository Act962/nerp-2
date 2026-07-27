"use client";

import { useRef } from "react";
import type { FocusPoint } from "../../lib/photo-adjustment";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Editor de polígono de foco: o usuário clica pra criar cada nó, arrasta pra
// movê-lo e dá duplo-clique pra removê-lo. Coordenadas em % do container, então
// serve pra qualquer proporção de espaço de foto.
export function FocusPolygonOverlay({
  points,
  onChange,
}: {
  points: FocusPoint[];
  onChange: (points: FocusPoint[]) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  const toPercent = (event: React.PointerEvent): FocusPoint => {
    const box = rootRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return {
      x: clamp(((event.clientX - box.left) / box.width) * 100, 0, 100),
      y: clamp(((event.clientY - box.top) / box.height) * 100, 0, 100),
    };
  };

  // Clique no fundo (fora de um nó) adiciona um nó novo.
  const addPoint = (event: React.PointerEvent) => {
    onChange([...points, toPercent(event)]);
  };

  const startDrag = (index: number) => (event: React.PointerEvent) => {
    event.stopPropagation();
    rootRef.current?.setPointerCapture(event.pointerId);
    dragIndexRef.current = index;
  };

  const move = (event: React.PointerEvent) => {
    const index = dragIndexRef.current;
    if (index == null) return;
    const next = toPercent(event);
    onChange(points.map((point, i) => (i === index ? next : point)));
  };

  const end = (event: React.PointerEvent) => {
    dragIndexRef.current = null;
    rootRef.current?.releasePointerCapture?.(event.pointerId);
  };

  const removePoint = (index: number) => (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange(points.filter((_, i) => i !== index));
  };

  return (
    <div
      ref={rootRef}
      onPointerDown={addPoint}
      onPointerMove={move}
      onPointerUp={end}
      role="application"
      aria-label="Desenhar área de foco: clique para adicionar nós"
      style={{
        position: "absolute",
        inset: 0,
        touchAction: "none",
        cursor: "crosshair",
      }}
    >
      {points.length >= 2 && (
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <polygon
            points={points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="rgba(37,99,235,0.12)"
            stroke="#2563eb"
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      {points.map((point, index) => (
        <button
          type="button"
          key={index}
          onPointerDown={startDrag(index)}
          onDoubleClick={removePoint(index)}
          title="Arraste para mover · duplo-clique para remover"
          aria-label={`Nó ${index + 1}`}
          style={{
            position: "absolute",
            left: `${point.x}%`,
            top: `${point.y}%`,
            width: 14,
            height: 14,
            marginLeft: -7,
            marginTop: -7,
            padding: 0,
            borderRadius: 999,
            background: "#fff",
            border: "2px solid #2563eb",
            cursor: "grab",
            touchAction: "none",
          }}
        />
      ))}
    </div>
  );
}
