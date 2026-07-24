"use client";

import { constructUrl } from "@/hooks/use-construct-url";
import {
  resolveVariables,
  type BookVariableValues,
} from "../../lib/book-variables";
import {
  COVER_CANVAS_HEIGHT,
  COVER_CANVAS_WIDTH,
  DEFAULT_COVER_BACKGROUND,
  resolveImageKey,
  type CoverBackground,
  type CoverElement,
} from "../../lib/cover-layout";
import {
  DEFAULT_BACKDROP_COLOR,
  focusPolygonCss,
  type PhotoAdjustment,
} from "../../lib/photo-adjustment";

// Render estático de um layout. Não usa Konva de propósito: serve pra
// miniaturas e pro preview do card, onde não há edição no canvas. Posicionar
// em `cqw` faz tudo escalar junto com o container, sem medir nada em JS.
function toCqw(value: number): string {
  return `${(value / COVER_CANVAS_WIDTH) * 100}cqw`;
}

export function isElementArray(value: unknown): value is CoverElement[] {
  return Array.isArray(value);
}

export function isBackground(value: unknown): value is CoverBackground {
  return (
    !!value &&
    typeof value === "object" &&
    "color" in value &&
    "opacity" in value
  );
}

export interface LayoutLogos {
  organization?: string | null;
  supplier?: string | null;
}

function PreviewElement({
  element,
  variableValues,
  photoUrls,
  photoAdjustments,
  onSlotClick,
  logos,
}: {
  element: CoverElement;
  variableValues?: BookVariableValues;
  photoUrls?: string[];
  photoAdjustments?: Array<PhotoAdjustment | undefined>;
  onSlotClick?: (slotIndex: number, hasPhoto: boolean) => void;
  logos?: LayoutLogos;
}) {
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
    const texto = resolveVariables(element.text, variableValues ?? {});
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
        {texto}
      </div>
    );
  }

  if (element.type === "image") {
    const key = resolveImageKey(element, logos);
    if (!key) return null;
    return (
      // biome-ignore lint/performance/noImgElement: preview de key do R2, sem otimização do next/image
      <img
        src={constructUrl(key)}
        alt=""
        loading="lazy"
        style={{ ...box, objectFit: element.objectFit }}
      />
    );
  }

  if (element.type === "divider") {
    return <div style={{ ...box, backgroundColor: element.color }} />;
  }

  if (element.type === "photoSlot") {
    const url = photoUrls?.[element.slotIndex];
    const adjustment = photoAdjustments?.[element.slotIndex];
    const clickable = !!onSlotClick;
    const strokeWidth = element.strokeWidth ?? 0;
    const moldura =
      strokeWidth > 0
        ? {
            border: `${toCqw(strokeWidth)} ${
              element.strokeDashed ? "dashed" : "solid"
            } ${element.strokeColor ?? "#1a1a1a"}`,
          }
        : {};
    // Ajuste por foto (o que o admin salva no "Ajustar enquadramento") tem
    // prioridade; sem ele, cai no enquadramento do próprio slot do layout.
    const scale = adjustment?.zoom ?? element.imageScale ?? 1;
    const objectPosition = adjustment
      ? `${adjustment.posX}% ${adjustment.posY}%`
      : `${element.imageOffsetX ?? 50}% ${element.imageOffsetY ?? 50}%`;
    const backdrop = adjustment?.backdrop ?? "none";
    const focusClip = focusPolygonCss(adjustment?.focusPolygon ?? []);
    // No modo desfoque a parte nítida só aparece com um polígono fechado; sem
    // ele, mostra só a versão borrada.
    const showSharp = backdrop !== "blur" || !!focusClip;
    const commonBox = {
      ...box,
      ...moldura,
      borderRadius: toCqw(element.cornerRadius),
      overflow: "hidden" as const,
      cursor: clickable ? ("pointer" as const) : undefined,
      padding: 0,
      background: "none",
    };
    // Botão de verdade quando clicável (acessível por teclado); div quando é só
    // exibição, pra não virar tab stop em miniaturas.
    const Tag = clickable ? "button" : "div";

    if (url) {
      return (
        <Tag
          type={clickable ? "button" : undefined}
          style={commonBox}
          onClick={
            clickable ? () => onSlotClick(element.slotIndex, true) : undefined
          }
        >
          {backdrop === "blur" && (
            // Foco seletivo: foto inteira desfocada; a parte nítida vem no
            // recorte por cima.
            // biome-ignore lint/performance/noImgElement: preview de key do R2, sem otimização do next/image
            <img
              src={url}
              alt=""
              aria-hidden
              loading="lazy"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition,
                transform: `scale(${scale})`,
                filter: "blur(5px)",
              }}
            />
          )}
          {backdrop === "color" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor:
                  adjustment?.backdropColor ?? DEFAULT_BACKDROP_COLOR,
              }}
            />
          )}
          {showSharp && (
            // biome-ignore lint/performance/noImgElement: preview de key do R2, sem otimização do next/image
            <img
              src={url}
              alt=""
              loading="lazy"
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                objectFit: backdrop === "blur" ? "cover" : element.objectFit,
                objectPosition,
                transform: `scale(${scale})`,
                clipPath: backdrop === "blur" ? focusClip : undefined,
              }}
            />
          )}
        </Tag>
      );
    }
    return (
      <Tag
        type={clickable ? "button" : undefined}
        style={{
          ...commonBox,
          backgroundColor: "#e5e7eb",
          border: moldura.border ?? "1px dashed #9ca3af",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: toCqw(16),
          color: "#6b7280",
        }}
        onClick={
          clickable ? () => onSlotClick(element.slotIndex, false) : undefined
        }
      >
        {clickable ? "+ Foto" : `Foto ${element.slotIndex + 1}`}
      </Tag>
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
        backgroundColor: element.fill,
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
        color: element.fontColor,
        fontSize: toCqw(element.fontSize),
        fontWeight: element.fontWeight === "bold" ? 700 : 400,
        overflow: "hidden",
      }}
    >
      {resolveVariables(element.text, variableValues ?? {})}
    </div>
  );
}

interface LayoutPreviewProps {
  layout: unknown;
  background: unknown;
  variableValues?: BookVariableValues;
  photoUrls?: string[];
  photoAdjustments?: Array<PhotoAdjustment | undefined>;
  onSlotClick?: (slotIndex: number, hasPhoto: boolean) => void;
  logos?: LayoutLogos;
  className?: string;
}

export function LayoutPreview({
  layout,
  background,
  variableValues,
  photoUrls,
  photoAdjustments,
  onSlotClick,
  logos,
  className,
}: LayoutPreviewProps) {
  const elements = isElementArray(layout) ? layout : [];
  const fundo = isBackground(background)
    ? background
    : DEFAULT_COVER_BACKGROUND;

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        overflow: "hidden",
        containerType: "inline-size",
        aspectRatio: `${COVER_CANVAS_WIDTH} / ${COVER_CANVAS_HEIGHT}`,
      }}
    >
      {fundo.imageKey && (
        // biome-ignore lint/performance/noImgElement: preview de key do R2, sem otimização do next/image
        <img
          src={constructUrl(fundo.imageKey)}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: fundo.color, opacity: fundo.opacity }}
      />
      {elements.map((element) => (
        <PreviewElement
          key={element.id}
          element={element}
          variableValues={variableValues}
          photoUrls={photoUrls}
          photoAdjustments={photoAdjustments}
          onSlotClick={onSlotClick}
          logos={logos}
        />
      ))}
    </div>
  );
}
