"use client";

import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import {
  Ellipse,
  Group,
  Image as KonvaImage,
  Line,
  Rect,
  Text,
} from "react-konva";
import useImage from "use-image";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  DEFAULT_FONT_FAMILY,
  resolveImageKey,
  type CoverElement,
  type CoverShapeElement,
} from "../../lib/cover-layout";
import {
  resolveVariables,
  type BookVariableValues,
} from "../../lib/book-variables";

interface CoverElementNodeProps {
  element: CoverElement;
  isSelected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onChange: (id: string, patch: Partial<CoverElement>) => void;
  // Valores de exemplo pros tokens {{variavel}} — sem eles o usuário monta o
  // layout olhando pra token cru e não consegue julgar tamanho de fonte.
  variableValues?: BookVariableValues;
  // Foto real do primeiro item do book pra preencher o slot no preview.
  photoPreviewUrl?: string;
  logos?: { organization?: string | null; supplier?: string | null };
}

const SELECTION_COLOR = "#2563eb";

function CoverImageNode({
  element,
  common,
  onChange,
  logos,
}: {
  element: Extract<CoverElement, { type: "image" }>;
  common: Record<string, unknown>;
  onChange: (patch: Partial<CoverElement>) => void;
  logos?: { organization?: string | null; supplier?: string | null };
}) {
  const chave = resolveImageKey(element, logos);
  const [image] = useImage(chave ? constructUrl(chave) : "", "anonymous");

  // Espaço preso a um logo que a org/indústria não tem some por completo do
  // canvas; o contorno tracejado mostra que o elemento existe e está vazio.
  if (!image) {
    return (
      <Group {...common}>
        <Rect
          width={element.width}
          height={element.height}
          stroke="#a3a3a3"
          strokeWidth={1}
          dash={[6, 4]}
          fill="#f5f5f5"
        />
        <Text
          width={element.width}
          height={element.height}
          text={
            element.imageSource === "organization"
              ? "Logo da organização"
              : element.imageSource === "supplier"
                ? "Logo da indústria"
                : "Imagem"
          }
          fontSize={12}
          fill="#737373"
          align="center"
          verticalAlign="middle"
        />
      </Group>
    );
  }

  return (
    <KonvaImage
      {...common}
      image={image}
      onTransformEnd={(event: KonvaEventObject<Event>) => {
        const node = event.target as Konva.Image;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: node.x(),
          y: node.y(),
          width: Math.max(10, element.width * scaleX),
          height: Math.max(10, element.height * scaleY),
          rotation: node.rotation(),
        });
      }}
    />
  );
}

function ShapeGeometry({ element }: { element: CoverShapeElement }) {
  const shared = {
    fill: element.fill,
    opacity: element.fillOpacity,
    stroke: element.strokeWidth > 0 ? element.strokeColor : undefined,
    strokeWidth: element.strokeWidth,
  };

  if (element.shape === "circle") {
    return (
      <Ellipse
        {...shared}
        x={element.width / 2}
        y={element.height / 2}
        radiusX={element.width / 2}
        radiusY={element.height / 2}
      />
    );
  }

  if (element.shape === "triangle") {
    return (
      <Line
        {...shared}
        points={[
          element.width / 2,
          0,
          element.width,
          element.height,
          0,
          element.height,
        ]}
        closed
      />
    );
  }

  return (
    <Rect
      {...shared}
      width={element.width}
      height={element.height}
      cornerRadius={element.shape === "rounded" ? 16 : 0}
    />
  );
}

function CoverPhotoSlotNode({
  element,
  photoPreviewUrl,
}: {
  element: Extract<CoverElement, { type: "photoSlot" }>;
  photoPreviewUrl?: string;
}) {
  const [image] = useImage(photoPreviewUrl ?? "", "anonymous");

  const strokeWidth = element.strokeWidth ?? 0;
  const contorno = strokeWidth > 0 && (
    <Rect
      width={element.width}
      height={element.height}
      cornerRadius={element.cornerRadius}
      stroke={element.strokeColor ?? "#1a1a1a"}
      strokeWidth={strokeWidth}
      dash={element.strokeDashed ? [10, 6] : undefined}
      listening={false}
    />
  );

  if (image) {
    // Recorta como object-fit: cover — sem isso a foto de exemplo aparece
    // esticada e o usuário dimensiona o slot com base numa mentira.
    const fit =
      element.objectFit === "cover"
        ? Math.max(element.width / image.width, element.height / image.height)
        : Math.min(element.width / image.width, element.height / image.height);
    const scale = fit * (element.imageScale ?? 1);
    const width = image.width * scale;
    const height = image.height * scale;
    // O recorte desloca a foto dentro do campo: 0% encosta a borda esquerda/
    // topo, 100% a direita/base, 50% centraliza.
    const offsetX =
      ((element.imageOffsetX ?? 50) / 100) * (element.width - width);
    const offsetY =
      ((element.imageOffsetY ?? 50) / 100) * (element.height - height);
    return (
      <>
        <Group
          clipFunc={(context) => {
            const radius = Math.min(
              element.cornerRadius,
              element.width / 2,
              element.height / 2,
            );
            // roundRect não existe no typing do Konva context; o path manual
            // garante que o recorte acompanhe o raio escolhido.
            context.beginPath();
            context.moveTo(radius, 0);
            context.lineTo(element.width - radius, 0);
            context.quadraticCurveTo(element.width, 0, element.width, radius);
            context.lineTo(element.width, element.height - radius);
            context.quadraticCurveTo(
              element.width,
              element.height,
              element.width - radius,
              element.height,
            );
            context.lineTo(radius, element.height);
            context.quadraticCurveTo(
              0,
              element.height,
              0,
              element.height - radius,
            );
            context.lineTo(0, radius);
            context.quadraticCurveTo(0, 0, radius, 0);
            context.closePath();
          }}
        >
          <KonvaImage
            image={image}
            x={offsetX}
            y={offsetY}
            width={width}
            height={height}
          />
        </Group>
        {contorno}
      </>
    );
  }

  return (
    <>
      <Rect
        width={element.width}
        height={element.height}
        fill="#f3f4f6"
        stroke="#9ca3af"
        strokeWidth={1}
        dash={[6, 4]}
        cornerRadius={element.cornerRadius}
      />
      <Text
        width={element.width}
        height={element.height}
        text={`Foto ${element.slotIndex + 1}`}
        fontSize={16}
        fill="#6b7280"
        align="center"
        verticalAlign="middle"
      />
      {contorno}
    </>
  );
}

export function CoverElementNode({
  element,
  isSelected,
  onSelect,
  onChange,
  variableValues,
  photoPreviewUrl,
  logos,
}: CoverElementNodeProps) {
  const handleSelect = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    event.cancelBubble = true;
    // Shift-clique adiciona/remove da seleção (multi-seleção).
    const additive = (event.evt as MouseEvent)?.shiftKey ?? false;
    onSelect(element.id, additive);
  };

  const handleDragEnd = (event: KonvaEventObject<DragEvent>) => {
    onChange(element.id, { x: event.target.x(), y: event.target.y() });
  };

  const patch = (value: Partial<CoverElement>) => onChange(element.id, value);

  const common = {
    id: element.id,
    name: "coverElement",
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    draggable: true,
    onMouseDown: handleSelect,
    onTap: handleSelect,
    onDragEnd: handleDragEnd,
    stroke: isSelected ? SELECTION_COLOR : undefined,
    strokeWidth: isSelected ? 1 : 0,
    dash: isSelected ? [4, 4] : undefined,
  };

  // Grupos (forma e slot de foto) desenham o próprio contorno de seleção: o
  // stroke do `common` não se aplica a um Group.
  const groupCommon = {
    id: element.id,
    name: "coverElement",
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    draggable: true,
    onMouseDown: handleSelect,
    onTap: handleSelect,
    onDragEnd: handleDragEnd,
    onTransformEnd: (event: KonvaEventObject<Event>) => {
      const node = event.target as Konva.Group;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      patch({
        x: node.x(),
        y: node.y(),
        width: Math.max(10, element.width * scaleX),
        height: Math.max(10, element.height * scaleY),
        rotation: node.rotation(),
      });
    },
  };

  const selectionOutline = isSelected ? (
    <Rect
      width={element.width}
      height={element.height}
      stroke={SELECTION_COLOR}
      strokeWidth={1}
      dash={[4, 4]}
      listening={false}
    />
  ) : null;

  if (element.type === "image") {
    return (
      <CoverImageNode
        element={element}
        common={common}
        onChange={patch}
        logos={logos}
      />
    );
  }

  if (element.type === "photoSlot") {
    return (
      <Group {...groupCommon}>
        <CoverPhotoSlotNode
          element={element}
          photoPreviewUrl={photoPreviewUrl}
        />
        {selectionOutline}
      </Group>
    );
  }

  if (element.type === "shape") {
    return (
      <Group {...groupCommon}>
        <ShapeGeometry element={element} />
        {element.text && (
          <Text
            width={element.width}
            height={element.height}
            text={resolveVariables(element.text, variableValues ?? {})}
            fontSize={element.fontSize}
            fontFamily={element.fontFamily ?? DEFAULT_FONT_FAMILY}
            fontStyle={element.fontWeight === "bold" ? "bold" : "normal"}
            fill={element.fontColor}
            align="center"
            verticalAlign="middle"
            padding={8}
            wrap="word"
            listening={false}
          />
        )}
        {selectionOutline}
      </Group>
    );
  }

  if (element.type === "divider") {
    return (
      <Rect
        {...common}
        fill={element.color}
        stroke={isSelected ? SELECTION_COLOR : undefined}
        onTransformEnd={(event: KonvaEventObject<Event>) => {
          const node = event.target as Konva.Rect;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          patch({
            x: node.x(),
            y: node.y(),
            width: Math.max(2, element.width * scaleX),
            height: Math.max(2, element.height * scaleY),
            rotation: node.rotation(),
          });
        }}
      />
    );
  }

  const resolvedText = resolveVariables(element.text, variableValues ?? {});

  return (
    <Text
      {...common}
      text={element.uppercase ? resolvedText.toUpperCase() : resolvedText}
      fontSize={element.fontSize}
      fontFamily={element.fontFamily ?? DEFAULT_FONT_FAMILY}
      fontStyle={element.fontWeight === "bold" ? "bold" : "normal"}
      fill={element.color}
      align={element.align}
      verticalAlign="middle"
      wrap="word"
      onTransformEnd={(event: KonvaEventObject<Event>) => {
        const node = event.target as Konva.Text;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        patch({
          x: node.x(),
          y: node.y(),
          width: Math.max(20, element.width * scaleX),
          height: Math.max(16, element.height * scaleY),
          rotation: node.rotation(),
        });
      }}
    />
  );
}
