"use client";

import type { KonvaEventObject } from "konva/lib/Node";
import { Circle, Group } from "react-konva";
import { ANNOTATION_META } from "../../engine/annotations";
import type { MapAnnotation } from "../../hooks/use-map-annotations";

interface AnnotationLayerProps {
  annotations: MapAnnotation[];
  selectedId: string | null;
  draggable: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}

const RADIUS = 0.35;

export function AnnotationLayer({
  annotations,
  selectedId,
  draggable,
  onSelect,
  onMove,
}: AnnotationLayerProps) {
  return (
    <>
      {annotations.map((annotation) => {
        const color = ANNOTATION_META[annotation.type].color;
        const isSelected = annotation.id === selectedId;

        const handleDragEnd = (event: KonvaEventObject<DragEvent>) => {
          onMove(annotation.id, event.target.x(), event.target.y());
        };

        return (
          <Group
            key={annotation.id}
            x={annotation.x}
            y={annotation.y}
            draggable={draggable}
            onClick={() => onSelect(annotation.id)}
            onTap={() => onSelect(annotation.id)}
            onDragEnd={handleDragEnd}
          >
            {isSelected && (
              <Circle
                radius={RADIUS * 1.7}
                stroke={color}
                strokeWidth={2}
                dash={[4, 3]}
                strokeScaleEnabled={false}
                listening={false}
              />
            )}
            <Circle
              radius={RADIUS}
              fill={color}
              stroke="#ffffff"
              strokeWidth={2}
              strokeScaleEnabled={false}
            />
            <Circle radius={RADIUS * 0.35} fill="#ffffff" listening={false} />
          </Group>
        );
      })}
    </>
  );
}
