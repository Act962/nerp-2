"use client";

import { constructUrl } from "@/hooks/use-construct-url";
import { useEffect } from "react";
import { Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import { useSceneStore } from "../../engine/scene-store";
import type { FloorPlanMeta } from "../../engine/types";

interface MapBackgroundProps {
  floorPlan: FloorPlanMeta;
}

export function MapBackground({ floorPlan }: MapBackgroundProps) {
  const setBackgroundImageSize = useSceneStore(
    (state) => state.setBackgroundImageSize,
  );
  const url = floorPlan.backgroundImageKey
    ? constructUrl(floorPlan.backgroundImageKey)
    : "";
  const [image] = useImage(url);

  // Reporta o tamanho natural (px) pra fitToPlan enquadrar pelo conteúdo real
  // em vez do widthM/heightM nominal da planta.
  useEffect(() => {
    if (image) {
      setBackgroundImageSize({ width: image.width, height: image.height });
    }
    return () => setBackgroundImageSize(null);
  }, [image, setBackgroundImageSize]);

  if (!floorPlan.backgroundImageKey || !image) return null;

  const transform = floorPlan.backgroundTransform;
  // A imagem é medida em pixels; a escala converte px -> metros (padrão: a
  // largura da imagem cobre a largura do mapa).
  const scale = transform?.scale ?? floorPlan.widthM / image.width;

  return (
    <KonvaImage
      image={image}
      x={transform?.x ?? 0}
      y={transform?.y ?? 0}
      scaleX={scale}
      scaleY={scale}
      rotation={transform?.rotation ?? 0}
      opacity={floorPlan.backgroundOpacity}
      listening={false}
    />
  );
}
