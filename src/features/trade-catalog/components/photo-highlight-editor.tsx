"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { uploadToR2 } from "@/lib/upload-to-r2";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { Eraser, PenLine, Spline, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Stage,
} from "react-konva";
import { toast } from "sonner";
import useImage from "use-image";
import { composeHighlight, type Vec2 } from "../lib/highlight-mask";

const LOGICAL_W = 720;
// Distância (em coords lógicas) do 1º nó pra fechar o contorno com um clique.
const CLOSE_THRESHOLD = 16;
// Distância mínima entre pontos capturados no modo caneta (evita spam de nós).
const PEN_MIN_STEP = 8;

type Mode = "nodes" | "pen";

interface PhotoHighlightEditorProps {
  file: File | null;
  onSaved: (key: string) => void;
  onOpenChange: (open: boolean) => void;
}

export function PhotoHighlightEditor({
  file,
  onSaved,
  onOpenChange,
}: PhotoHighlightEditorProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setBlobUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const [image] = useImage(blobUrl ?? "");
  // Watermark do Órbita servido de /public (mesma origem, sem taint). Opcional:
  // se o arquivo ainda não estiver lá, a imagem sobe sem watermark.
  const [watermark] = useImage("/watermark-orbita.png");
  const aspect = image ? image.width / image.height : 16 / 9;
  const logicalHeight = LOGICAL_W / aspect;

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [scale, setScale] = useState(0);
  const isDrawingRef = useRef(false);

  const [points, setPoints] = useState<Vec2[]>([]);
  const [closed, setClosed] = useState(false);
  const [mode, setMode] = useState<Mode>("nodes");
  const [dimOpacity, setDimOpacity] = useState(0.4);
  const [isSaving, setIsSaving] = useState(false);

  // Reseta o traçado a cada foto nova. `file` não é lido no corpo — é o
  // GATILHO. Removê-lo, como a regra sugere, faria o traçado da foto anterior
  // sobreviver por cima da nova.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `file` é o gatilho do reset, não uma leitura
  useEffect(() => {
    setPoints([]);
    setClosed(false);
    setMode("nodes");
    setDimOpacity(0.4);
  }, [file]);

  // `blobUrl` reassina o observer quando a imagem troca: o elemento medido é
  // outro, e sem isso a escala fica travada na dimensão da foto anterior.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `blobUrl` reassina o observer na troca de imagem
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / LOGICAL_W);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [blobUrl]);

  const flatPoints = useMemo(
    () =>
      points.flatMap((point) => [point.x * LOGICAL_W, point.y * logicalHeight]),
    [points, logicalHeight],
  );

  const getNormalized = (): Vec2 | null => {
    const stage = stageRef.current;
    const position = stage?.getRelativePointerPosition();
    if (!position) return null;
    return { x: position.x / LOGICAL_W, y: position.y / logicalHeight };
  };

  const closeNearFirst = (point: Vec2): boolean => {
    if (points.length < 3) return false;
    const first = points[0];
    const dx = (point.x - first.x) * LOGICAL_W;
    const dy = (point.y - first.y) * logicalHeight;
    return Math.hypot(dx, dy) <= CLOSE_THRESHOLD;
  };

  const handleStageMouseDown = (
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    if (closed) return;
    const point = getNormalized();
    if (!point) return;

    if (mode === "pen") {
      isDrawingRef.current = true;
      setPoints((current) => [...current, point]);
      return;
    }

    // modo nós: clicar perto do 1º nó fecha; senão adiciona vértice.
    if (closeNearFirst(point)) {
      setClosed(true);
      return;
    }
    // Ignora clique que caiu num handle (deixa o drag do nó agir).
    if (event.target !== stageRef.current) return;
    setPoints((current) => [...current, point]);
  };

  const handleStageMouseMove = () => {
    if (mode !== "pen" || !isDrawingRef.current || closed) return;
    const point = getNormalized();
    if (!point) return;
    setPoints((current) => {
      const last = current[current.length - 1];
      if (last) {
        const dx = (point.x - last.x) * LOGICAL_W;
        const dy = (point.y - last.y) * logicalHeight;
        if (Math.hypot(dx, dy) < PEN_MIN_STEP) return current;
      }
      return [...current, point];
    });
  };

  const handleStageMouseUp = () => {
    if (mode === "pen" && isDrawingRef.current) {
      isDrawingRef.current = false;
      if (points.length >= 3) setClosed(true);
    }
  };

  const handleNodeDrag = (
    index: number,
    event: KonvaEventObject<DragEvent>,
  ) => {
    const node = event.target;
    setPoints((current) =>
      current.map((point, currentIndex) =>
        currentIndex === index
          ? { x: node.x() / LOGICAL_W, y: node.y() / logicalHeight }
          : point,
      ),
    );
  };

  const undoLast = () => {
    setClosed(false);
    setPoints((current) => current.slice(0, -1));
  };

  const clearAll = () => {
    setClosed(false);
    setPoints([]);
  };

  const handleClose = (open: boolean) => {
    if (isSaving) return;
    onOpenChange(open);
  };

  // Sobe pro R2 e fecha; assume que isSaving já foi ligado pelo chamador.
  const finishUpload = async (toUpload: File) => {
    try {
      const key = await uploadToR2(toUpload);
      onSaved(key);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao enviar a foto",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Sempre passa pelo canvas (mesmo "sem destaque") pra o watermark ser
  // gravado na imagem. Sem polígono → imagem cheia + watermark.
  const composeAndUpload = async (highlightPoints: Vec2[]) => {
    if (!image) return;
    setIsSaving(true);
    try {
      const blob = await composeHighlight(
        image,
        highlightPoints,
        dimOpacity,
        watermark,
      );
      await finishUpload(new File([blob], "modelo.png", { type: "image/png" }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao gerar a imagem",
      );
      setIsSaving(false);
    }
  };

  const handleUseRaw = () => composeAndUpload([]);
  const handleSaveHighlight = () => {
    if (points.length < 3) return;
    return composeAndUpload(points);
  };

  const canHighlight = closed && points.length >= 3;

  return (
    <Dialog open={!!file} onOpenChange={handleClose}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Destacar o espaço da foto modelo</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={mode === "nodes" ? "default" : "ghost"}
              className="h-7 gap-1.5"
              onClick={() => setMode("nodes")}
            >
              <Spline className="size-3.5" />
              Nós
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "pen" ? "default" : "ghost"}
              className="h-7 gap-1.5"
              onClick={() => setMode("pen")}
            >
              <PenLine className="size-3.5" />
              Caneta
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1.5"
            disabled={points.length === 0}
            onClick={undoLast}
          >
            <Undo2 className="size-3.5" />
            Desfazer
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1.5"
            disabled={points.length === 0}
            onClick={clearAll}
          >
            <Eraser className="size-3.5" />
            Limpar
          </Button>
          {!closed && points.length >= 3 && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7"
              onClick={() => setClosed(true)}
            >
              Fechar contorno
            </Button>
          )}
          <div className="ml-auto flex w-48 items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">
              Fundo {Math.round(dimOpacity * 100)}%
            </span>
            <Slider
              min={10}
              max={90}
              step={5}
              value={[dimOpacity * 100]}
              onValueChange={([next]) => setDimOpacity(next / 100)}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {mode === "nodes"
            ? "Clique para adicionar nós ao redor do espaço. Clique no primeiro nó (ou em “Fechar contorno”) para fechar; arraste os nós para ajustar."
            : "Segure e arraste para contornar o espaço à mão livre."}
        </p>

        <div
          ref={containerRef}
          className="w-full overflow-hidden rounded-lg border"
          style={{
            aspectRatio: `${LOGICAL_W} / ${logicalHeight}`,
            backgroundColor: "#f3f4f6",
            backgroundImage:
              "conic-gradient(#e5e7eb 90deg, transparent 90deg 180deg, #e5e7eb 180deg 270deg, transparent 270deg)",
            backgroundSize: "20px 20px",
            cursor: closed ? "default" : "crosshair",
          }}
        >
          {image && scale > 0 && (
            <Stage
              ref={stageRef}
              width={LOGICAL_W * scale}
              height={logicalHeight * scale}
              scaleX={scale}
              scaleY={scale}
              onMouseDown={handleStageMouseDown}
              onMouseMove={handleStageMouseMove}
              onMouseUp={handleStageMouseUp}
              onTouchStart={handleStageMouseDown}
              onTouchMove={handleStageMouseMove}
              onTouchEnd={handleStageMouseUp}
            >
              <Layer listening={false}>
                <KonvaImage
                  image={image}
                  width={LOGICAL_W}
                  height={logicalHeight}
                  opacity={dimOpacity}
                />
              </Layer>

              {canHighlight && (
                <Layer listening={false}>
                  <Group
                    clipFunc={(context) => {
                      context.beginPath();
                      points.forEach((point, index) => {
                        const x = point.x * LOGICAL_W;
                        const y = point.y * logicalHeight;
                        if (index === 0) context.moveTo(x, y);
                        else context.lineTo(x, y);
                      });
                      context.closePath();
                    }}
                  >
                    <KonvaImage
                      image={image}
                      width={LOGICAL_W}
                      height={logicalHeight}
                    />
                  </Group>
                </Layer>
              )}

              <Layer>
                {points.length > 0 && (
                  <Line
                    points={flatPoints}
                    closed={closed}
                    stroke="#2563eb"
                    strokeWidth={2}
                    strokeScaleEnabled={false}
                    dash={closed ? undefined : [6, 4]}
                    listening={false}
                  />
                )}
                {points.map((point, index) => (
                  <Circle
                    key={index}
                    x={point.x * LOGICAL_W}
                    y={point.y * logicalHeight}
                    radius={6}
                    fill={index === 0 ? "#f97316" : "#2563eb"}
                    stroke="#ffffff"
                    strokeWidth={2}
                    strokeScaleEnabled={false}
                    draggable={mode === "nodes"}
                    onDragMove={(event) => handleNodeDrag(index, event)}
                  />
                ))}
              </Layer>
            </Stage>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={isSaving}
            onClick={handleUseRaw}
          >
            Usar sem destaque
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!canHighlight || isSaving}
              onClick={handleSaveHighlight}
            >
              Salvar destaque
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
