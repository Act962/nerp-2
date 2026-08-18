"use client";

import { constructUrl } from "@/hooks/use-construct-url";
import {
  COVER_CANVAS_HEIGHT,
  COVER_CANVAS_WIDTH,
  DEFAULT_COVER_BACKGROUND,
  type CoverBackground,
  type CoverElement,
} from "../../lib/cover-layout";

// Preview estático da capa do padrão. Não usa Konva de propósito: um card de
// listagem não justifica carregar o canvas, e posicionar em `cqw` deixa a
// miniatura escalar sozinha com o card, sem medir nada em JS.
function toCqw(value: number): string {
  return `${(value / COVER_CANVAS_WIDTH) * 100}cqw`;
}

function isElementArray(value: unknown): value is CoverElement[] {
  return Array.isArray(value);
}

function isBackground(value: unknown): value is CoverBackground {
  return (
    !!value &&
    typeof value === "object" &&
    "color" in value &&
    "opacity" in value
  );
}

function ThumbnailElement({ element }: { element: CoverElement }) {
  const box = {
    position: "absolute" as const,
    left: toCqw(element.x),
    top: toCqw(element.y),
    width: toCqw(element.width),
    height: toCqw(element.height),
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: "top left",
  };

  if (element.type === "text") {
    return (
      <div
        style={{
          ...box,
          fontSize: toCqw(element.fontSize),
          color: element.color,
          fontWeight: element.fontWeight === "bold" ? 700 : 400,
          textAlign: element.align,
          textTransform: element.uppercase ? "uppercase" : undefined,
          lineHeight: 1.2,
          overflow: "hidden",
        }}
      >
        {element.text}
      </div>
    );
  }

  if (element.type === "image") {
    if (!element.imageKey) return null;
    return (
      // biome-ignore lint/performance/noImgElement: preview de key do R2, sem otimização do next/image
      <img
        src={constructUrl(element.imageKey)}
        alt=""
        style={{ ...box, objectFit: element.objectFit }}
      />
    );
  }

  if (element.type === "divider") {
    return <div style={{ ...box, backgroundColor: element.color }} />;
  }

  if (element.type === "photoSlot") {
    return (
      <div
        style={{
          ...box,
          backgroundColor: "#e5e7eb",
          border: "1px dashed #9ca3af",
          borderRadius: toCqw(element.cornerRadius),
        }}
      />
    );
  }

  const radius =
    element.shape === "circle"
      ? "50%"
      : element.shape === "rounded"
        ? toCqw(16)
        : undefined;

  return (
    <div
      style={{
        ...box,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor:
          element.shape === "triangle" ? undefined : element.fill,
        opacity: element.fillOpacity,
        borderRadius: radius,
        border:
          element.strokeWidth > 0
            ? `${toCqw(element.strokeWidth)} solid ${element.strokeColor}`
            : undefined,
        // Triângulo não tem primitiva em CSS: recorta o retângulo.
        clipPath:
          element.shape === "triangle"
            ? "polygon(50% 0%, 100% 100%, 0% 100%)"
            : undefined,
        ...(element.shape === "triangle"
          ? { backgroundColor: element.fill }
          : {}),
        color: element.fontColor,
        fontSize: toCqw(element.fontSize),
        fontWeight: element.fontWeight === "bold" ? 700 : 400,
        overflow: "hidden",
      }}
    >
      {element.text}
    </div>
  );
}

interface TemplateThumbnailProps {
  coverLayout: unknown;
  coverBackground: unknown;
}

export function TemplateThumbnail({
  coverLayout,
  coverBackground,
}: TemplateThumbnailProps) {
  const elements = isElementArray(coverLayout) ? coverLayout : [];
  const background = isBackground(coverBackground)
    ? coverBackground
    : DEFAULT_COVER_BACKGROUND;

  return (
    <div
      className="relative w-full overflow-hidden border-b bg-muted"
      style={{
        containerType: "inline-size",
        aspectRatio: `${COVER_CANVAS_WIDTH} / ${COVER_CANVAS_HEIGHT}`,
      }}
    >
      {background.imageKey && (
        // biome-ignore lint/performance/noImgElement: preview de key do R2, sem otimização do next/image
        <img
          src={constructUrl(background.imageKey)}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: background.color,
          opacity: background.opacity,
        }}
      />
      {elements.map((element) => (
        <ThumbnailElement key={element.id} element={element} />
      ))}
    </div>
  );
}
