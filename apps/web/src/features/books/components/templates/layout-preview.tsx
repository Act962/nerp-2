"use client";

import type { ReactNode } from "react";
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
  photoVariables,
  photoUrls,
  photoAdjustments,
  photoNumbers,
  showPhotoNumbers = true,
  onSlotClick,
  logos,
}: {
  element: CoverElement;
  variableValues?: BookVariableValues;
  photoVariables?: Record<number, BookVariableValues>;
  photoUrls?: string[];
  photoAdjustments?: Array<PhotoAdjustment | undefined>;
  photoNumbers?: Record<number, number>;
  // Interruptor do book: false esconde a tarja "FOTO N" de TODOS os espaços.
  // Não mexe na variável {{numeroFoto}} dos textos — a numeração continua
  // existindo, só não é carimbada dentro da foto.
  showPhotoNumbers?: boolean;
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
    // Texto com "Foto de referência": as variáveis por foto vencem as da página.
    const values =
      element.photoRef != null && photoVariables?.[element.photoRef]
        ? { ...variableValues, ...photoVariables[element.photoRef] }
        : variableValues;
    const texto = resolveVariables(element.text, values ?? {});
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
    // Fit efetivo: o ajuste por foto ("Preencher/Caber inteira") vence o do slot.
    // "contain" mostra a foto inteira (assinatura/senha/logo sem corte).
    const effectiveFit = adjustment?.objectFit ?? element.objectFit;
    const showSharp = backdrop !== "blur" || !!focusClip;
    // Legenda "FOTO N": numeração sequencial no book (só quando o slot tem foto
    // e não foi desativada no padrão).
    const photoNumber = photoNumbers?.[element.slotIndex];
    const showNumber =
      showPhotoNumbers && element.showNumber !== false && photoNumber != null;
    // "Caber inteira" sem fundo atrás: o que sobra da moldura é página, não
    // foto. O espaço deixa de capturar clique (o container abre "Editar
    // layout") e quem recebe é a <img>, já reduzida ao tamanho que aparece.
    const letterbox =
      clickable && effectiveFit === "contain" && backdrop === "none";
    const commonBox = {
      ...box,
      ...moldura,
      borderRadius: toCqw(element.cornerRadius),
      overflow: "hidden" as const,
      cursor: clickable ? ("pointer" as const) : undefined,
      padding: 0,
      background: "none",
      ...(letterbox
        ? {
            display: "flex" as const,
            alignItems: "center" as const,
            justifyContent: "center" as const,
            pointerEvents: "none" as const,
          }
        : {}),
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
            clickable
              ? (event) => {
                  // O container do preview abre "Editar layout" no clique;
                  // a foto tem ação própria (trocar) e para o evento aqui.
                  event.stopPropagation();
                  onSlotClick(element.slotIndex, true);
                }
              : undefined
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
              style={
                letterbox
                  ? {
                      // Elemento do tamanho da foto que aparece: é ele o alvo
                      // do clique, e o PDF também trata "caber inteira" sem
                      // zoom (cover-layout-view.tsx), então os dois batem.
                      position: "relative",
                      maxWidth: "100%",
                      maxHeight: "100%",
                      width: "auto",
                      height: "auto",
                      pointerEvents: "auto",
                      cursor: "pointer",
                    }
                  : {
                      position: "relative",
                      width: "100%",
                      height: "100%",
                      objectFit: backdrop === "blur" ? "cover" : effectiveFit,
                      objectPosition,
                      transform: `scale(${scale})`,
                      clipPath: backdrop === "blur" ? focusClip : undefined,
                    }
              }
            />
          )}
          {showNumber && (
            <span
              style={{
                position: "absolute",
                bottom: toCqw(6),
                right: toCqw(8),
                backgroundColor: "rgba(0,0,0,0.6)",
                color: "#ffffff",
                fontSize: toCqw(16),
                fontWeight: 700,
                lineHeight: 1,
                padding: `${toCqw(3)} ${toCqw(7)}`,
                borderRadius: toCqw(4),
              }}
            >
              FOTO {photoNumber}
            </span>
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
          clickable
            ? (event) => {
                event.stopPropagation();
                onSlotClick(element.slotIndex, false);
              }
            : undefined
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
  photoVariables?: Record<number, BookVariableValues>;
  photoUrls?: string[];
  photoAdjustments?: Array<PhotoAdjustment | undefined>;
  photoNumbers?: Record<number, number>;
  // Interruptor do book: false esconde a tarja "FOTO N" dentro das fotos.
  showPhotoNumbers?: boolean;
  onSlotClick?: (slotIndex: number, hasPhoto: boolean) => void;
  /**
   * Controles desenhados POR CIMA de cada espaço de foto (ajustar, remover).
   *
   * Camada separada, e não filho do slot, por dois motivos: o slot clicável é
   * um `<button>` e botão dentro de botão é HTML inválido; e a sobreposição
   * precisa ficar acima da foto. Só o editor passa isto — miniatura e o render
   * do PDF (que é server-side, react-pdf) não têm nada disso.
   */
  slotOverlay?: (slotIndex: number, hasPhoto: boolean) => ReactNode;
  logos?: LayoutLogos;
  className?: string;
}

export function LayoutPreview({
  layout,
  background,
  variableValues,
  photoVariables,
  photoUrls,
  photoAdjustments,
  photoNumbers,
  showPhotoNumbers,
  onSlotClick,
  slotOverlay,
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
          photoVariables={photoVariables}
          photoUrls={photoUrls}
          photoAdjustments={photoAdjustments}
          photoNumbers={photoNumbers}
          showPhotoNumbers={showPhotoNumbers}
          onSlotClick={onSlotClick}
          logos={logos}
        />
      ))}
      {slotOverlay &&
        elements.map((element) => {
          if (element.type !== "photoSlot") return null;
          const url = photoUrls?.[element.slotIndex];
          const adjustment = photoAdjustments?.[element.slotIndex];
          // Mesma conta do slot: com "caber inteira" e sem fundo, a foto ocupa
          // só o miolo da moldura — e é nela, não na moldura, que os controles
          // precisam encostar. A <img> invisível dá exatamente essa caixa.
          const encolhida =
            !!url &&
            (adjustment?.objectFit ?? element.objectFit) === "contain" &&
            (adjustment?.backdrop ?? "none") === "none";
          return (
            <div
              key={`overlay-${element.id}`}
              style={{
                position: "absolute",
                left: toCqw(element.x),
                top: toCqw(element.y),
                width: toCqw(element.width),
                height: toCqw(element.height),
                transform: element.rotation
                  ? `rotate(${element.rotation}deg)`
                  : undefined,
                transformOrigin: "top left",
                // A camada cobre o slot inteiro; só os controles recebem
                // clique, senão ela roubaria o "clique na foto para trocar".
                pointerEvents: "none",
                display: encolhida ? "flex" : undefined,
                alignItems: encolhida ? "center" : undefined,
                justifyContent: encolhida ? "center" : undefined,
              }}
            >
              {encolhida ? (
                <div
                  style={{
                    position: "relative",
                    maxWidth: "100%",
                    maxHeight: "100%",
                  }}
                >
                  {/* Só serve de régua: mesma origem e mesmas regras de
                      tamanho da foto visível, sem baixar nada duas vezes (a
                      resposta já está no cache do navegador). */}
                  {/* biome-ignore lint/performance/noImgElement: régua de medida, não conteúdo */}
                  <img
                    src={url}
                    alt=""
                    aria-hidden
                    style={{
                      display: "block",
                      maxWidth: "100%",
                      maxHeight: "100%",
                      width: "auto",
                      height: "auto",
                      visibility: "hidden",
                    }}
                  />
                  {slotOverlay(element.slotIndex, true)}
                </div>
              ) : (
                slotOverlay(element.slotIndex, !!url)
              )}
            </div>
          );
        })}
    </div>
  );
}
