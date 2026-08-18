"use client";

import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import {
  Image as KonvaImage,
  Layer,
  Rect,
  Stage,
  Transformer,
} from "react-konva";
import useImage from "use-image";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  COVER_CANVAS_HEIGHT,
  COVER_CANVAS_WIDTH,
  type CoverBackground,
  type CoverElement,
} from "../../lib/cover-layout";
import type { BookVariableValues } from "../../lib/book-variables";
import { CoverElementNode } from "./cover-element-node";

// Preenche o canvas inteiro tipo `object-fit: cover` — sem essa conta a
// imagem de fundo ficaria esticada/distorcida quando a proporção dela não
// bate com 960x540.
function BackgroundImage({ imageKey }: { imageKey: string }) {
  const [image] = useImage(constructUrl(imageKey), "anonymous");
  if (!image) return null;

  const scale = Math.max(
    COVER_CANVAS_WIDTH / image.width,
    COVER_CANVAS_HEIGHT / image.height,
  );
  const width = image.width * scale;
  const height = image.height * scale;

  return (
    <KonvaImage
      image={image}
      x={(COVER_CANVAS_WIDTH - width) / 2}
      y={(COVER_CANVAS_HEIGHT - height) / 2}
      width={width}
      height={height}
      listening={false}
    />
  );
}

interface CoverStageProps {
  elements: CoverElement[];
  background: CoverBackground;
  selectedIds: string[];
  onSelect: (id: string | null, additive?: boolean) => void;
  onChange: (id: string, patch: Partial<CoverElement>) => void;
  variableValues?: BookVariableValues;
  // Fotos reais do primeiro item do book, por índice de slot — deixa o
  // preview do layout de página fiel ao que sai no PDF.
  photoPreviewUrls?: string[];
  logos?: { organization?: string | null; supplier?: string | null };
}

export function CoverStage({
  elements,
  background,
  selectedIds,
  onSelect,
  onChange,
  variableValues,
  photoPreviewUrls,
  logos,
}: CoverStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [scale, setScale] = useState(1);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // Espaço de foto tem proporção fixa (3:4 ou 4:3): quando só slots estão
  // selecionados, o resize trava na proporção (só cantos, sem anchors laterais)
  // e a rotação fica desabilitada — o padrão de dimensão não pode ser distorcido.
  const onlyPhotoSlots =
    selectedIds.length > 0 &&
    selectedIds.every(
      (id) =>
        elements.find((element) => element.id === id)?.type === "photoSlot",
    );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / COVER_CANVAS_WIDTH);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Transformer com TODOS os selecionados: resize/rotação valem em grupo. O
  // move em grupo é tratado pelo efeito de arraste abaixo.
  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    const nodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter((node): node is Konva.Node => Boolean(node));
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds]);

  // Arraste em grupo: ao arrastar um nó selecionado com vários na seleção,
  // aplica o mesmo deslocamento aos demais (ao vivo) e comita no fim.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || selectedIds.length < 2) return;
    let starts: Map<string, { x: number; y: number }> | null = null;
    let draggedId: string | null = null;

    const begin = (event: Konva.KonvaEventObject<DragEvent>) => {
      const id = event.target?.id?.();
      if (!id || !selectedIds.includes(id)) {
        starts = null;
        return;
      }
      draggedId = id;
      starts = new Map();
      for (const sid of selectedIds) {
        const n = stage.findOne(`#${sid}`);
        if (n) starts.set(sid, { x: n.x(), y: n.y() });
      }
    };
    const move = (event: Konva.KonvaEventObject<DragEvent>) => {
      if (!starts || !draggedId || event.target?.id?.() !== draggedId) return;
      const from = starts.get(draggedId);
      if (!from) return;
      const dx = event.target.x() - from.x;
      const dy = event.target.y() - from.y;
      for (const [sid, pos] of starts) {
        if (sid === draggedId) continue;
        stage.findOne(`#${sid}`)?.position({ x: pos.x + dx, y: pos.y + dy });
      }
      // Mantém a caixa do Transformer acompanhando os nós movidos.
      transformerRef.current?.forceUpdate();
      stage.batchDraw();
    };
    const end = (event: Konva.KonvaEventObject<DragEvent>) => {
      if (!starts || !draggedId || event.target?.id?.() !== draggedId) {
        starts = null;
        draggedId = null;
        return;
      }
      const from = starts.get(draggedId);
      const dx = event.target.x() - (from?.x ?? 0);
      const dy = event.target.y() - (from?.y ?? 0);
      for (const [sid, pos] of starts) {
        if (sid === draggedId) continue;
        onChange(sid, { x: pos.x + dx, y: pos.y + dy });
      }
      starts = null;
      draggedId = null;
    };

    stage.on("dragstart.multi", begin);
    stage.on("dragmove.multi", move);
    stage.on("dragend.multi", end);
    return () => {
      stage.off("dragstart.multi");
      stage.off("dragmove.multi");
      stage.off("dragend.multi");
    };
  }, [selectedIds, onChange]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded-lg border shadow-sm"
      style={{
        aspectRatio: `${COVER_CANVAS_WIDTH} / ${COVER_CANVAS_HEIGHT}`,
        // Xadrez cinza atrás do canvas — deixa visível o efeito de
        // transparência quando a opacidade do fundo é menor que 100%.
        backgroundColor: "#f3f4f6",
        backgroundImage:
          "conic-gradient(#e5e7eb 90deg, transparent 90deg 180deg, #e5e7eb 180deg 270deg, transparent 270deg)",
        backgroundSize: "20px 20px",
      }}
    >
      {scale > 0 && (
        <Stage
          ref={stageRef}
          width={COVER_CANVAS_WIDTH * scale}
          height={COVER_CANVAS_HEIGHT * scale}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={(event) => {
            if (event.target === stageRef.current) onSelect(null);
          }}
          onTouchStart={(event) => {
            if (event.target === stageRef.current) onSelect(null);
          }}
        >
          <Layer listening={false}>
            {background.imageKey && (
              <BackgroundImage imageKey={background.imageKey} />
            )}
            <Rect
              x={0}
              y={0}
              width={COVER_CANVAS_WIDTH}
              height={COVER_CANVAS_HEIGHT}
              fill={background.color}
              opacity={background.opacity}
            />
          </Layer>
          <Layer>
            {elements.map((element) => (
              <CoverElementNode
                key={element.id}
                element={element}
                isSelected={selectedIds.includes(element.id)}
                onSelect={onSelect}
                onChange={onChange}
                variableValues={variableValues}
                logos={logos}
                photoPreviewUrl={
                  element.type === "photoSlot"
                    ? photoPreviewUrls?.[element.slotIndex]
                    : undefined
                }
              />
            ))}
            <Transformer
              ref={transformerRef}
              rotateEnabled={!onlyPhotoSlots}
              keepRatio={onlyPhotoSlots}
              enabledAnchors={
                onlyPhotoSlots
                  ? ["top-left", "top-right", "bottom-left", "bottom-right"]
                  : undefined
              }
              // Os anchors são desenhados no espaço do stage, que está
              // escalado pra caber na tela: sem dividir pelo scale eles
              // encolhem junto e no celular viram alvos de 4px.
              anchorSize={(isTouch ? 22 : 10) / scale}
              anchorStrokeWidth={1 / scale}
              borderStrokeWidth={1 / scale}
              rotateAnchorOffset={(isTouch ? 34 : 20) / scale}
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < 10 || newBox.height < 10 ? oldBox : newBox
              }
            />
          </Layer>
        </Stage>
      )}
    </div>
  );
}
