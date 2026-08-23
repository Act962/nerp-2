"use client";

import { forwardRef, useRef, useState, useEffect } from "react";
import type { CSSProperties } from "react";
import type { CatalogConfig, CatalogProduct } from "../types";
import { DEFAULT_PRICE_STYLE, TEXT_SIZE_CSS } from "../types";
import { CardStandard } from "./cards/card-standard";
import { CardCompact } from "./cards/card-compact";
import { CardList } from "./cards/card-list";
import { CardMinimal } from "./cards/card-minimal";
import { CardFreeLayout } from "./cards/card-free-layout";
import { imageStyleFromAdjust } from "./cards/image-style";
import { getContrastColor } from "@/utils/get-contrast-color";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  type DynamicContext,
  resolveEntityImageKey,
  resolveEntityText,
} from "../lib/resolve-entity";

export type SupplierLogo = { id: string; name: string; logo: string };

// 1×1 transparente — placeholder de etiqueta dinâmica sem imagem resolvida
// (evita img quebrada / re-fetch da página com src vazio).
const TRANSPARENT_PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=";

// Produto placeholder para um bloco de estilo ainda sem produto escolhido —
// mantém o bloco visível/posicionável no canvas até o usuário adicionar um real.
const BLOCK_PLACEHOLDER: CatalogProduct = {
  id: "__block_placeholder__",
  name: "Produto",
  sku: "",
  thumbnail: "",
  salePrice: 0,
  unit: "UN",
  promotionalPrice: null,
  discount: null,
  savings: null,
  categoryName: null,
  currentStock: 0,
  description: null,
};

interface CatalogPreviewProps {
  config: CatalogConfig;
  products: CatalogProduct[];
  // Lista COMPLETA de produtos do catálogo (todas as páginas). Usada para
  // resolver o produto de um bloco de estilo, que pode não estar na fatia
  // desta página. Ausente = cai em `products` (a fatia da página).
  allProducts?: CatalogProduct[];
  supplierLogos?: SupplierLogo[];
  // Entidades resolvidas da PÁGINA DINÂMICA (loja/org/produto/usuário). Textos e
  // etiquetas com `binding` resolvem daqui no render. Ausente = sem dinâmicos.
  dynamicContext?: DynamicContext;
}

// Escolhe o canto inferior (esquerda/direita) com MENOS conteúdo por baixo para
// a marca d'água. Considera etiquetas, textos e o grupo de produtos posicionado.
function pickWatermarkCorner(
  config: CatalogConfig,
  pageH: number,
): "left" | "right" {
  const W = 1080;
  const CW = 0.34; // largura da região do canto (fração)
  const CH = 0.2; // altura da faixa inferior (fração)
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  for (const o of config.overlays ?? [])
    boxes.push({ x: o.x / W, y: o.y / pageH, w: o.w / W, h: o.h / pageH });
  for (const t of config.texts ?? [])
    boxes.push({ x: t.x / W, y: t.y / pageH, w: t.w / W, h: t.h / pageH });
  if (config.productGroup) {
    const g = config.productGroup;
    boxes.push({ x: g.x / W, y: g.y / pageH, w: g.w / W, h: g.h / pageH });
  }
  for (const g of config.productGroups ?? [])
    boxes.push({
      x: g.rect.x / W,
      y: g.rect.y / pageH,
      w: g.rect.w / W,
      h: g.rect.h / pageH,
    });
  const busy = (x0: number, x1: number) =>
    boxes.some(
      (b) => b.x + b.w > x0 && b.x < x1 && b.y + b.h > 1 - CH && b.y < 1,
    );
  const leftBusy = busy(0, CW);
  const rightBusy = busy(1 - CW, 1);
  if (rightBusy && !leftBusy) return "left";
  return "right"; // livre dos dois lados, ou ambos ocupados → direita
}

const gridClass: Record<string, string> = {
  "grid-2": "grid grid-cols-2 gap-4",
  "grid-3": "grid grid-cols-3 gap-4",
  "grid-4": "grid grid-cols-4 gap-3",
  list: "flex flex-col gap-3",
  featured: "flex flex-col gap-4",
  carousel: "flex gap-4 overflow-x-auto",
  masonry: "columns-3 gap-4",
  table: "flex flex-col gap-0",
};

export function renderCard(
  product: CatalogProduct,
  config: CatalogConfig,
  thumbSrcs: Record<string, string>,
) {
  // Contorno do card (cor + espessura) — Layout > Card.
  const cardBorder =
    config.cardBorderWidth && config.cardBorderWidth > 0
      ? `${config.cardBorderWidth}px solid ${config.cardBorderColor ?? "#111111"}`
      : undefined;

  // Estilo da FOTO (aplicado no template E na variável "Foto" do card livre) —
  // controlado pelos toggles de "IMAGEM" no painel Layout > Card.
  const photoBox: CSSProperties = {
    backgroundColor: config.hideImageBackground
      ? undefined
      : (config.imageBackgroundColor ?? config.cardColor),
    border: config.hideImageBorder ? undefined : "1px solid rgba(0,0,0,0.12)",
    boxShadow: config.hideImageShadow
      ? undefined
      : "0 1px 4px rgba(0,0,0,0.18)",
  };

  // Card livre (editor de variáveis + formas): quando há elementos, desenha o
  // card livremente, substituindo o template de `cardStyle`. Resolução:
  // override por produto > card da página/global (já resolvido em config.cardLayout).
  const freeLayout =
    config.cardLayoutOverrides?.[product.id] ?? config.cardLayout;
  if (freeLayout && freeLayout.length > 0) {
    return (
      <div
        key={product.id}
        className="overflow-hidden rounded-lg"
        style={{
          backgroundColor: config.hideCardBackground
            ? "transparent"
            : config.cardColor,
          border: cardBorder,
        }}
      >
        <CardFreeLayout
          product={product}
          elements={freeLayout}
          photoBox={photoBox}
          aspectRatio={
            config.cardAspectRatio ? String(config.cardAspectRatio) : undefined
          }
          thumbSrc={
            product.thumbnail ? thumbSrcs[product.thumbnail] : undefined
          }
        />
      </div>
    );
  }

  const cardStyle = {
    backgroundColor:
      config.hideCardBackground || config.hideImageBackground
        ? "transparent"
        : (config.imageBackgroundColor ?? config.cardColor),
  };
  // `cardColor` só define a cor do TEXTO (contraste) — mantém a cor real mesmo
  // com fundo transparente, senão o texto ficaria ilegível.
  const cardColor = config.cardColor;
  const textConfig = {
    textSize: config.textSize,
    fontWeight: config.fontWeight,
  };
  const priceStyle = {
    ...(config.priceStyleOverrides?.[product.id] ??
      config.priceStyle ??
      DEFAULT_PRICE_STYLE),
    hideBorder: config.hidePriceBorder ?? false,
  };
  const imageBox = {
    margin: config.imageMargin ?? 0,
    padding: {
      top: config.imagePaddingTop ?? 0,
      right: config.imagePaddingRight ?? 0,
      bottom: config.imagePaddingBottom ?? 0,
      left: config.imagePaddingLeft ?? 0,
    },
    hideBorder: config.hideImageBorder ?? false,
    hideShadow: config.hideImageShadow ?? false,
    hideBackground: config.hideImageBackground ?? false,
  };
  const imageAdjust = config.imageAdjustments?.[product.id];
  // Foto embutida como data URL (via proxy same-origin) quando disponível — o
  // export com html-to-image não consegue buscar do R2 (CORS), então cai no
  // placeholder. Fallback pra URL direta enquanto o data URL não resolveu.
  const imageSrc = product.thumbnail
    ? (thumbSrcs[product.thumbnail] ?? constructUrl(product.thumbnail))
    : "";
  const showUnit = config.showUnit ?? true;
  switch (config.cardStyle) {
    case "compact":
      return (
        <CardCompact
          key={product.id}
          product={product}
          cardStyle={cardStyle}
          cardColor={cardColor}
          priceStyle={priceStyle}
          imageBox={imageBox}
          imageAdjust={imageAdjust}
          imageSrc={imageSrc}
          showUnit={showUnit}
          config={textConfig}
        />
      );
    case "list":
      return (
        <CardList
          key={product.id}
          product={product}
          cardStyle={cardStyle}
          cardColor={cardColor}
          priceStyle={priceStyle}
          imageBox={imageBox}
          imageAdjust={imageAdjust}
          imageSrc={imageSrc}
          showUnit={showUnit}
          config={{
            showCategory: config.showCategory,
            showStock: config.showStock,
            ...textConfig,
          }}
        />
      );
    case "minimal":
      return (
        <CardMinimal
          key={product.id}
          product={product}
          cardStyle={cardStyle}
          cardColor={cardColor}
          priceStyle={priceStyle}
          imageBox={imageBox}
          imageAdjust={imageAdjust}
          imageSrc={imageSrc}
          showUnit={showUnit}
          config={textConfig}
        />
      );
    default:
      return (
        <CardStandard
          key={product.id}
          product={product}
          cardStyle={cardStyle}
          cardColor={cardColor}
          priceStyle={priceStyle}
          imageBox={imageBox}
          imageAdjust={imageAdjust}
          imageSrc={imageSrc}
          showUnit={showUnit}
          config={{
            showDescription: config.showDescription,
            showCategory: config.showCategory,
            showStock: config.showStock,
            showSku: config.showSku,
            ...textConfig,
          }}
        />
      );
  }
}

// Cor hex + transparência (0..100%) → rgba. Aplica opacidade só no FUNDO da
// região do grupo (os produtos por cima ficam opacos).
function hexToRgba(hex: string, opacityPct: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = Number.parseInt(full.slice(0, 2), 16) || 0;
  const g = Number.parseInt(full.slice(2, 4), 16) || 0;
  const b = Number.parseInt(full.slice(4, 6), 16) || 0;
  const a = Math.max(0, Math.min(100, opacityPct)) / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const PAGE_W = 1080;
const PAGE_H: Record<CatalogConfig["pageSize"], number> = {
  square: 1080,
  story: 1920,
  portrait: 1440,
};

export const CatalogPreview = forwardRef<HTMLDivElement, CatalogPreviewProps>(
  (
    { config, products, allProducts, supplierLogos = [], dynamicContext },
    ref,
  ) => {
    const dynCtx = dynamicContext ?? {};
    const outerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [bgDataUrl, setBgDataUrl] = useState<string>("");

    const pageH =
      config.pageAspect && config.pageAspect > 0
        ? Math.round(PAGE_W / config.pageAspect)
        : PAGE_H[config.pageSize];

    useEffect(() => {
      const el = outerRef.current;
      if (!el) return;
      const observer = new ResizeObserver(([entry]) => {
        setScale(entry.contentRect.width / PAGE_W);
      });
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      const key = config.backgroundImage;
      if (!key) {
        setBgDataUrl("");
        return;
      }
      let cancelled = false;
      fetch(`/api/s3/image?key=${encodeURIComponent(key)}`)
        .then((res) =>
          res.ok ? res.blob() : Promise.reject(new Error(`${res.status}`)),
        )
        .then(
          (blob) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error("FileReader error"));
              reader.readAsDataURL(blob);
            }),
        )
        .then((dataUrl) => {
          if (!cancelled) setBgDataUrl(dataUrl);
        })
        .catch(() => {
          if (!cancelled) setBgDataUrl(constructUrl(key));
        });
      return () => {
        cancelled = true;
      };
    }, [config.backgroundImage]);

    // Fotos dos produtos como data URL (via proxy same-origin). Sem isso o
    // html-to-image não embute a imagem do R2 no export (CORS) e ela vira o
    // placeholder. Enquanto resolve, o card usa a URL direta (constructUrl).
    const [thumbSrcs, setThumbSrcs] = useState<Record<string, string>>({});
    const thumbKeysSig = [
      ...new Set(
        [
          ...products.map((p) => p.thumbnail),
          ...(config.overlays ?? []).map((o) => o.assetKey),
          // Chaves R2 resolvidas de etiquetas dinâmicas (foto da loja / logo da
          // org / foto do produto) — precisam do proxy p/ export CORS-safe. URLs
          // absolutas (user.image) usam src direto e ficam de fora.
          ...(config.overlays ?? [])
            .map((o) =>
              o.binding ? resolveEntityImageKey(o.binding, dynCtx) : null,
            )
            .filter((k): k is string => !!k && !k.startsWith("http")),
        ].filter(Boolean),
      ),
    ]
      .sort()
      .join("|");

    useEffect(() => {
      const keys = thumbKeysSig ? thumbKeysSig.split("|") : [];
      if (keys.length === 0) {
        setThumbSrcs({});
        return;
      }
      let cancelled = false;
      Promise.all(
        keys.map(async (key) => {
          try {
            const res = await fetch(
              `/api/s3/image?key=${encodeURIComponent(key)}`,
            );
            if (!res.ok) throw new Error(`${res.status}`);
            const blob = await res.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error("FileReader error"));
              reader.readAsDataURL(blob);
            });
            return [key, dataUrl] as const;
          } catch {
            return [key, constructUrl(key)] as const;
          }
        }),
      ).then((entries) => {
        if (!cancelled) setThumbSrcs(Object.fromEntries(entries));
      });
      return () => {
        cancelled = true;
      };
    }, [thumbKeysSig]);

    const isFeatured = config.layout === "featured";
    // Escala proporcional do grupo (modo "proporção"): quando ≠ 1, todo o bloco
    // (cards + textos) escala junto, ancorado no canto superior-esquerdo.
    const groupScale = config.productGroupScale ?? 1;
    const groupScaleStyle: CSSProperties =
      groupScale !== 1
        ? { transform: `scale(${groupScale})`, transformOrigin: "top left" }
        : {};
    // Grupo de produtos posicionado (Fase 5): quando há retângulo salvo, a grade
    // vira um bloco absoluto nessas coords do canvas (senão, fluxo padrão).
    const groupPos: CSSProperties | undefined = config.productGroup
      ? {
          position: "absolute",
          left: config.productGroup.x,
          top: config.productGroup.y,
          width: config.productGroup.w,
          height: config.productGroup.h,
          overflow: "hidden",
          ...groupScaleStyle,
        }
      : undefined;
    const titleColor = getContrastColor(config.backgroundColor);
    const cardBorder =
      config.cardBorderWidth && config.cardBorderWidth > 0
        ? `${config.cardBorderWidth}px solid ${config.cardBorderColor ?? "#111111"}`
        : undefined;
    const cardStyle = {
      backgroundColor: config.hideImageBackground
        ? "transparent"
        : config.cardColor,
      border: cardBorder,
    };
    const cardColor = config.cardColor;

    const logos = config.showFooterSuppliers === false ? [] : supplierLogos;
    const mid = Math.ceil(logos.length / 2);
    const logosLeft = logos.slice(0, mid);
    const logosRight = logos.slice(mid);

    // O transform fica no wrapper intermediário, nunca no ref exportado.
    // html-to-image usa getBoundingClientRect() no ref — se ele tivesse
    // scale aplicado, o canvas de captura seria menor que 1080px e
    // cliparia o conteúdo à direita.
    return (
      <div
        ref={outerRef}
        className="rounded-lg overflow-hidden"
        style={{ aspectRatio: `${PAGE_W}/${pageH}`, position: "relative" }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: PAGE_W,
            height: pageH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <div
            ref={ref}
            style={{
              width: PAGE_W,
              height: pageH,
              overflow: "hidden",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
              paddingTop: config.paddingTop,
              paddingRight: config.paddingRight,
              paddingBottom: config.paddingBottom,
              paddingLeft: config.paddingLeft,
            }}
          >
            {/* Marca d'água Órbita — canto inferior livre (auto). Fica por cima
                do conteúdo, semitransparente, e é capturada no export. */}
            {config.watermark !== false && (
              <div
                style={{
                  position: "absolute",
                  bottom: Math.round(pageH * 0.03),
                  ...(pickWatermarkCorner(config, pageH) === "left"
                    ? { left: Math.round(PAGE_W * 0.03) }
                    : { right: Math.round(PAGE_W * 0.03) }),
                  width: Math.round(PAGE_W * 0.24),
                  zIndex: 8,
                  opacity: 0.85,
                  pointerEvents: "none",
                }}
              >
                {/* biome-ignore lint/performance/noImgElement: exportado via html-to-image */}
                <img
                  src="/watermark-orbita.png"
                  alt=""
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </div>
            )}

            {/* Camada de fundo (por página): cor/degradê + imagem, com
                transparência. Fica atrás de todo o conteúdo. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity:
                  config.backgroundOpacity != null
                    ? config.backgroundOpacity / 100
                    : undefined,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  ...(config.backgroundGradient
                    ? {
                        backgroundImage: `linear-gradient(${config.backgroundGradient.angle}deg, ${config.backgroundGradient.from}, ${config.backgroundGradient.to})`,
                      }
                    : { backgroundColor: config.backgroundColor }),
                }}
              />
              {(bgDataUrl || config.backgroundImage) && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: bgDataUrl
                      ? `url('${bgDataUrl}')`
                      : `url('${constructUrl(config.backgroundImage)}')`,
                    backgroundSize: config.backgroundFit,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                  }}
                />
              )}
            </div>
            {(config.showTitle !== false ||
              (config.showSubtitle !== false && !!config.subtitle)) && (
              <div className="mb-6 text-center shrink-0">
                {config.showTitle !== false && (
                  <h2
                    className="text-2xl font-bold"
                    style={{ color: titleColor }}
                  >
                    {config.title || "Promoções"}
                  </h2>
                )}
                {config.showSubtitle !== false && config.subtitle && (
                  <p
                    className="text-sm mt-1"
                    style={{ color: titleColor, opacity: 0.7 }}
                  >
                    {config.subtitle}
                  </p>
                )}
              </div>
            )}

            {config.productGroups && config.productGroups.length > 0 ? (
              // Modo multi-grupo: cada grupo é uma grade posicionável (rect
              // próprio) com sua fatia de produtos (auto-split sequencial).
              (() => {
                const groups = config.productGroups ?? [];
                // Grupos NOMEADOS mostram os SEUS produtos (por pertencimento);
                // grupos de capacidade (sem productIds) recebem a fatia dos NÃO
                // agrupados. O último grupo recolhe qualquer sobra pra nada sumir.
                const namedIds = new Set(
                  groups.flatMap((g) => g.productIds ?? []),
                );
                const ungrouped = products.filter((p) => !namedIds.has(p.id));
                let capIdx = 0;
                return groups.map((g, gi) => {
                  const cols = Math.max(1, g.gridCols);
                  const cap = cols * Math.max(1, g.gridRows);
                  const isLast = gi === groups.length - 1;
                  let slice: typeof products;
                  if (g.productIds && g.productIds.length > 0) {
                    const set = new Set(g.productIds);
                    slice = products.filter((p) => set.has(p.id));
                    if (isLast) slice = [...slice, ...ungrouped];
                  } else {
                    slice = isLast
                      ? ungrouped.slice(capIdx)
                      : ungrouped.slice(capIdx, capIdx + cap);
                    capIdx += cap;
                  }
                  return (
                    <div
                      key={g.id}
                      data-role="product-group"
                      data-group-id={g.id}
                      className="grid gap-4"
                      style={{
                        position: "absolute",
                        left: g.rect.x,
                        top: g.rect.y,
                        width: g.rect.w,
                        minHeight: g.rect.h,
                        background: g.bgColor
                          ? hexToRgba(g.bgColor, g.bgOpacity ?? 100)
                          : undefined,
                        borderRadius: g.radius ? `${g.radius}px` : undefined,
                        border:
                          (g.borderWidth ?? 0) > 0
                            ? `${g.borderWidth}px solid ${g.borderColor ?? "#000000"}`
                            : undefined,
                        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                        gridAutoRows: "minmax(min-content, 1fr)",
                      }}
                    >
                      {slice.map((p, i) => {
                        const loneLast =
                          cols > 1 &&
                          i === slice.length - 1 &&
                          slice.length % cols === 1;
                        const card = renderCard(p, config, thumbSrcs);
                        return loneLast ? (
                          <div
                            key={p.id}
                            className="grid"
                            style={{
                              gridColumn: "1 / -1",
                              justifySelf: "center",
                              width: `calc((100% - ${(cols - 1) * 16}px) / ${cols})`,
                            }}
                          >
                            {card}
                          </div>
                        ) : (
                          card
                        );
                      })}
                    </div>
                  );
                });
              })()
            ) : products.length === 0 ? (
              <div
                className="flex-1 flex items-center justify-center text-sm"
                style={{ color: titleColor, opacity: 0.5 }}
              >
                Nenhum produto promocional encontrado
              </div>
            ) : isFeatured && products.length > 0 ? (
              <div
                data-role="product-group"
                className={
                  config.productGroup
                    ? "overflow-hidden flex flex-col gap-4"
                    : "flex-1 overflow-hidden flex flex-col gap-4"
                }
                style={groupPos}
              >
                <div className="shrink-0">
                  <CardStandard
                    product={products[0]}
                    cardStyle={cardStyle}
                    cardColor={cardColor}
                    priceStyle={{
                      ...(config.priceStyleOverrides?.[products[0].id] ??
                        config.priceStyle ??
                        DEFAULT_PRICE_STYLE),
                      hideBorder: config.hidePriceBorder ?? false,
                    }}
                    imageBox={{
                      margin: config.imageMargin ?? 0,
                      padding: {
                        top: config.imagePaddingTop ?? 0,
                        right: config.imagePaddingRight ?? 0,
                        bottom: config.imagePaddingBottom ?? 0,
                        left: config.imagePaddingLeft ?? 0,
                      },
                      hideBorder: config.hideImageBorder ?? false,
                      hideShadow: config.hideImageShadow ?? false,
                      hideBackground: config.hideImageBackground ?? false,
                    }}
                    imageAdjust={config.imageAdjustments?.[products[0].id]}
                    imageSrc={
                      products[0].thumbnail
                        ? (thumbSrcs[products[0].thumbnail] ??
                          constructUrl(products[0].thumbnail))
                        : ""
                    }
                    showUnit={config.showUnit ?? true}
                    config={{
                      showDescription: config.showDescription,
                      showCategory: config.showCategory,
                      showStock: config.showStock,
                      showSku: config.showSku,
                      textSize: config.textSize,
                      fontWeight: config.fontWeight,
                    }}
                  />
                </div>
                <div className={gridClass["grid-3"]}>
                  {products
                    .slice(1)
                    .map((p) => renderCard(p, config, thumbSrcs))}
                </div>
              </div>
            ) : config.layout === "custom" ? (
              (() => {
                const cols = Math.max(1, config.gridCols ?? 3);
                return (
                  <div
                    data-role="product-group"
                    className="grid gap-4"
                    style={{
                      ...(config.productGroup
                        ? {
                            position: "absolute",
                            left: config.productGroup.x,
                            top: config.productGroup.y,
                            width: config.productGroup.w,
                            // minHeight (não height) + linhas em minmax(min-content,
                            // 1fr): a grade preenche o box quando há espaço, mas
                            // NUNCA encolhe um card abaixo do seu conteúdo nem o
                            // corta — cresce para baixo se preciso.
                            minHeight: config.productGroup.h,
                            gridAutoRows: "minmax(min-content, 1fr)",
                            ...groupScaleStyle,
                          }
                        : {}),
                      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    }}
                  >
                    {products.map((p, i) => {
                      // Item sozinho na última linha → centralizado (ocupa a
                      // linha inteira, mas com a largura de uma coluna).
                      const loneLast =
                        cols > 1 &&
                        i === products.length - 1 &&
                        products.length % cols === 1;
                      const card = renderCard(p, config, thumbSrcs);
                      return loneLast ? (
                        <div
                          key={p.id}
                          className="grid"
                          style={{
                            gridColumn: "1 / -1",
                            justifySelf: "center",
                            width: `calc((100% - ${(cols - 1) * 16}px) / ${cols})`,
                          }}
                        >
                          {card}
                        </div>
                      ) : (
                        card
                      );
                    })}
                  </div>
                );
              })()
            ) : (
              <div
                data-role="product-group"
                className={gridClass[config.layout] ?? "grid grid-cols-3 gap-4"}
                style={groupPos}
              >
                {products.map((p) => renderCard(p, config, thumbSrcs))}
              </div>
            )}

            {config.showFooter !== false && config.footerText && (
              <div
                className="mt-4 text-center shrink-0"
                style={{
                  color: titleColor,
                  opacity: 0.6,
                  fontSize: TEXT_SIZE_CSS[config.footerTextSize ?? "xs"],
                }}
              >
                {config.footerText}
              </div>
            )}

            {logosLeft.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: config.paddingBottom,
                  left: config.paddingLeft,
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 12,
                }}
              >
                {logosLeft.map((s) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={s.id}
                    src={constructUrl(s.logo)}
                    alt={s.name}
                    style={{ height: 56, maxWidth: 140, objectFit: "contain" }}
                  />
                ))}
              </div>
            )}

            {logosRight.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: config.paddingBottom,
                  right: config.paddingRight,
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 12,
                }}
              >
                {logosRight.map((s) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={s.id}
                    src={constructUrl(s.logo)}
                    alt={s.name}
                    style={{ height: 56, maxWidth: 140, objectFit: "contain" }}
                  />
                ))}
              </div>
            )}

            {/* Etiquetas (overlays) — px no canvas 1080×pageH, capturadas no
                export. As alças de mover/redimensionar ficam num layer à parte,
                fora deste ref, então não entram na imagem. */}
            {(config.overlays ?? []).map((ov) => {
              const transforms = [
                ov.rotation ? `rotate(${ov.rotation}deg)` : "",
                ov.flipH ? "scaleX(-1)" : "",
                ov.flipV ? "scaleY(-1)" : "",
              ]
                .filter(Boolean)
                .join(" ");
              // Etiqueta dinâmica: resolve a chave/URL da entidade; senão usa o
              // asset estático. URLs absolutas (user.image) vão direto.
              const boundKey = ov.binding
                ? resolveEntityImageKey(ov.binding, dynCtx)
                : null;
              const imgKey = boundKey ?? ov.assetKey;
              const src = !imgKey
                ? TRANSPARENT_PX
                : imgKey.startsWith("http")
                  ? imgKey
                  : (thumbSrcs[imgKey] ?? constructUrl(imgKey));
              // Enquadramento (redimensionador): usa o ajuste quando houver;
              // senão "Caber" (contain). O box recorta (overflow-hidden) para o
              // zoom/Cobrir funcionarem sem vazar.
              const imgStyle = ov.adjust
                ? imageStyleFromAdjust(ov.adjust)
                : ({ objectFit: "contain" } as const);
              return (
                <div
                  key={ov.id}
                  style={{
                    position: "absolute",
                    left: ov.x,
                    top: ov.y,
                    width: ov.w,
                    height: ov.h,
                    transform: transforms || undefined,
                    opacity: ov.opacity != null ? ov.opacity / 100 : undefined,
                    borderRadius: ov.radius ? ov.radius : undefined,
                    border:
                      ov.borderWidth && ov.borderWidth > 0
                        ? `${ov.borderWidth}px solid ${ov.borderColor ?? "#000000"}`
                        : undefined,
                    overflow: "hidden",
                    pointerEvents: "none",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    style={{ width: "100%", height: "100%", ...imgStyle }}
                  />
                </div>
              );
            })}

            {/* Blocos de texto (ferramenta "Texto") — px no canvas 1080×pageH.
                Texto dinâmico: resolve da entidade; senão usa o texto estático. */}
            {(config.texts ?? []).map((t) => {
              const content = t.binding
                ? (resolveEntityText(t.binding, dynCtx) ?? t.text)
                : t.text;
              return (
                <div
                  key={t.id}
                  style={{
                    position: "absolute",
                    left: t.x,
                    top: t.y,
                    width: t.w,
                    height: t.h,
                    transform: t.rotation
                      ? `rotate(${t.rotation}deg)`
                      : undefined,
                    opacity: t.opacity != null ? t.opacity / 100 : undefined,
                    color: t.color,
                    fontFamily: t.fontFamily,
                    fontSize: t.fontSize,
                    lineHeight: t.lineHeight ?? 1.15,
                    letterSpacing: t.letterSpacing
                      ? `${t.letterSpacing}px`
                      : undefined,
                    fontWeight: t.bold ? 700 : 400,
                    fontStyle: t.italic ? "italic" : undefined,
                    textDecoration:
                      [
                        t.underline ? "underline" : "",
                        t.strikethrough ? "line-through" : "",
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined,
                    textTransform: t.uppercase ? "uppercase" : undefined,
                    textAlign: t.align ?? "left",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent:
                      t.anchor === "top"
                        ? "flex-start"
                        : t.anchor === "bottom"
                          ? "flex-end"
                          : "center",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    overflow: "hidden",
                    pointerEvents: "none",
                    // Caixa (borda/fundo) — igual ao "Texto" do Montar card.
                    ...(t.boxed
                      ? {
                          backgroundColor: t.boxFill ?? "#ffffff",
                          border:
                            t.boxBorderWidth && t.boxBorderWidth > 0
                              ? `${t.boxBorderWidth}px solid ${t.boxBorderColor ?? "#111111"}`
                              : undefined,
                          borderRadius: t.boxRadius ?? 0,
                          padding: 8,
                        }
                      : {}),
                  }}
                >
                  {t.list
                    ? content
                        .split("\n")
                        .map((line) => `•  ${line}`)
                        .join("\n")
                    : content}
                </div>
              );
            })}

            {/* Blocos de estilo individuais — cards livres posicionáveis ligados
                a um produto. px no canvas 1080×pageH, capturados no export. As
                alças de mover/redimensionar ficam no SelectionLayer (fora do ref). */}
            {(config.styleBlocks ?? []).map((block) => {
              // Resolve na lista COMPLETA (o produto do bloco pode estar em
              // outra página). Sem produto escolhido (ou ainda carregando), usa
              // um placeholder para o bloco continuar visível/posicionável.
              const pool = allProducts ?? products;
              const product =
                pool.find((p) => p.id === block.productId) ?? BLOCK_PLACEHOLDER;
              const blockPhotoBox: CSSProperties = {
                backgroundColor: config.hideImageBackground
                  ? undefined
                  : (config.imageBackgroundColor ?? config.cardColor),
                border: config.hideImageBorder
                  ? undefined
                  : "1px solid rgba(0,0,0,0.12)",
                boxShadow: config.hideImageShadow
                  ? undefined
                  : "0 1px 4px rgba(0,0,0,0.18)",
              };
              return (
                <div
                  key={block.id}
                  style={{
                    position: "absolute",
                    left: block.x,
                    top: block.y,
                    width: block.w,
                    height: block.h,
                    transform: block.rotation
                      ? `rotate(${block.rotation}deg)`
                      : undefined,
                    opacity:
                      block.opacity != null ? block.opacity / 100 : undefined,
                    backgroundColor: config.hideCardBackground
                      ? "transparent"
                      : config.cardColor,
                    borderRadius: 8,
                    overflow: "hidden",
                    pointerEvents: "none",
                  }}
                >
                  <CardFreeLayout
                    product={product}
                    elements={block.cardLayout}
                    photoBox={blockPhotoBox}
                    aspectRatio={`${block.w} / ${block.h}`}
                    thumbSrc={
                      product.thumbnail
                        ? thumbSrcs[product.thumbnail]
                        : undefined
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  },
);

CatalogPreview.displayName = "CatalogPreview";
