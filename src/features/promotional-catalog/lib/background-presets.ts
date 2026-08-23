import { constructUrl } from "@/hooks/use-construct-url";
import type { CatalogConfig } from "../types";
import { PAGE_H_VALUES, PAGE_W } from "./layout";

// Presets de fundo embutidos para o passo "Nome + fundo" do wizard da aba
// "Lista". Só cor/degradê (sem asset novo). Aplicar = espalhar estes campos de
// aparência no config (e propagar às páginas, que são per-página).
export type BackgroundPreset = {
  id: string;
  name: string;
  // Campos de aparência aplicados no config/páginas.
  bg: Pick<CatalogConfig, "backgroundColor"> &
    Partial<Pick<CatalogConfig, "backgroundGradient" | "backgroundOpacity">>;
};

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: "white", name: "Branco limpo", bg: { backgroundColor: "#ffffff" } },
  {
    id: "red",
    name: "Oferta vermelha",
    bg: {
      backgroundColor: "#e11d2a",
      backgroundGradient: { from: "#e11d2a", to: "#8a0f18", angle: 160 },
    },
  },
  {
    id: "yellow",
    name: "Promo amarela",
    bg: {
      backgroundColor: "#fbbf24",
      backgroundGradient: { from: "#fde047", to: "#f59e0b", angle: 160 },
    },
  },
  {
    id: "blue",
    name: "Azul",
    bg: {
      backgroundColor: "#1d4ed8",
      backgroundGradient: { from: "#3b82f6", to: "#1e3a8a", angle: 160 },
    },
  },
  {
    id: "green",
    name: "Verde",
    bg: {
      backgroundColor: "#16a34a",
      backgroundGradient: { from: "#22c55e", to: "#14532d", angle: 160 },
    },
  },
  {
    id: "dark",
    name: "Escuro",
    bg: {
      backgroundColor: "#0f172a",
      backgroundGradient: { from: "#1e293b", to: "#0f172a", angle: 160 },
    },
  },
];

// Estilo CSS de preview de um preset (para a miniatura no wizard).
export function presetPreviewStyle(p: BackgroundPreset): React.CSSProperties {
  const g = p.bg.backgroundGradient;
  return g
    ? { backgroundImage: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` }
    : { backgroundColor: p.bg.backgroundColor };
}

// Altura da página (px no canvas) — proporção exata (`pageAspect`) quando há,
// senão o preset. Espelha `pageHeightOf` do editor/preview.
function pageHeightOf(
  config: Pick<CatalogConfig, "pageAspect" | "pageSize">,
): number {
  return config.pageAspect && config.pageAspect > 0
    ? Math.round(PAGE_W / config.pageAspect)
    : PAGE_H_VALUES[config.pageSize];
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

type FocusConfig = Pick<
  CatalogConfig,
  | "layout"
  | "gridCols"
  | "gridRows"
  | "productGroup"
  | "productGroups"
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft"
  | "pageAspect"
  | "pageSize"
>;

// Retângulo EXATO do card na página, em frações (0..1) das dimensões do fundo:
// (fx, fy) = canto superior-esquerdo; (fw, fh) = largura/altura; `aspect` =
// proporção real da célula (px), para dimensionar a caixa do preview sem
// distorcer o recorte do fundo.
export type CropRect = {
  fx: number;
  fy: number;
  fw: number;
  fh: number;
  aspect: number;
};

// Campos de fundo (por página) usados pelos previews do card.
export type PageBgConfig = Pick<
  CatalogConfig,
  "backgroundColor" | "backgroundGradient" | "backgroundImage" | "backgroundFit"
>;

// Espaçamento entre cards da grade (Tailwind `gap-4` = 16px no canvas).
const GRID_GAP = 16;

// Retângulo (px no canvas) onde a grade é desenhada + colunas e a contagem de
// produtos DAQUELE grupo + o índice LOCAL do produto nele. Espelha o
// posicionamento de `catalog-preview` (productGroups → productGroup → fluxo).
function gridRectFor(
  config: FocusConfig,
  index: number,
  pageProductCount: number,
) {
  const pageH = pageHeightOf(config);
  const groups = config.productGroups;
  if (groups && groups.length > 0) {
    let start = 0;
    let gi = 0;
    for (; gi < groups.length - 1; gi++) {
      const cap =
        Math.max(1, groups[gi].gridCols) * Math.max(1, groups[gi].gridRows);
      if (index < start + cap) break;
      start += cap;
    }
    const g = groups[Math.min(gi, groups.length - 1)];
    const cols = Math.max(1, g.gridCols);
    const isLast = gi === groups.length - 1;
    const cap = cols * Math.max(1, g.gridRows);
    const rest = Math.max(0, pageProductCount - start);
    const groupCount = isLast ? rest : Math.min(cap, rest);
    return { ...g.rect, cols, groupCount, local: Math.max(0, index - start) };
  }
  const cols =
    config.layout === "custom"
      ? Math.max(1, config.gridCols ?? 3)
      : config.layout === "grid-2"
        ? 2
        : config.layout === "grid-4"
          ? 4
          : 3;
  if (config.productGroup) {
    return {
      ...config.productGroup,
      cols,
      groupCount: pageProductCount,
      local: index,
    };
  }
  const l = config.paddingLeft ?? 0;
  const t = config.paddingTop ?? 0;
  return {
    x: l,
    y: t,
    w: PAGE_W - l - (config.paddingRight ?? 0),
    h: pageH - t - (config.paddingBottom ?? 0),
    cols,
    groupCount: pageProductCount,
    local: index,
  };
}

// Retângulo exato da célula do produto `index` (frações da página). As LINHAS
// reais = ceil(itensDoGrupo / colunas) — a grade estica as linhas para preencher
// a altura do grupo, então a célula é (h − gaps)/linhas, não gridRows. Null
// quando não há índice (ex.: linha avulsa da aba Lista).
export function productCropRect(
  config: FocusConfig,
  index: number,
  pageProductCount: number,
): CropRect | null {
  if (index == null || index < 0) return null;
  const pageH = pageHeightOf(config);
  const g = gridRectFor(config, index, pageProductCount);
  const cols = g.cols;
  const rows = Math.max(1, Math.ceil(Math.max(1, g.groupCount) / cols));
  const col = g.local % cols;
  const row = Math.min(rows - 1, Math.floor(g.local / cols));
  const cellW = Math.max(1, (g.w - (cols - 1) * GRID_GAP) / cols);
  const cellH = Math.max(1, (g.h - (rows - 1) * GRID_GAP) / rows);
  const x = g.x + col * (cellW + GRID_GAP);
  const y = g.y + row * (cellH + GRID_GAP);
  return {
    fx: clamp01(x / PAGE_W),
    fy: clamp01(y / pageH),
    fw: clamp01(cellW / PAGE_W),
    fh: clamp01(cellH / pageH),
    aspect: cellW / cellH,
  };
}

// Fundo de um preview cuja caixa TEM a proporção da célula (`crop.aspect`):
// recorta EXATAMENTE o retângulo do card no fundo (cor, degradê ou imagem) — as
// 4 bordas do card mapeiam nas 4 bordas da caixa. Sem `crop` → fundo inteiro
// (cover). Retorna null p/ fundo BRANCO (o chamador mantém o cinza padrão).
export function cardPreviewBg(
  config: PageBgConfig,
  crop?: CropRect | null,
): React.CSSProperties | null {
  const {
    backgroundColor,
    backgroundGradient,
    backgroundImage,
    backgroundFit,
  } = config;
  if (backgroundImage) {
    const base = {
      backgroundColor: backgroundColor || undefined,
      backgroundImage: `url("${constructUrl(backgroundImage)}")`,
      backgroundRepeat: "no-repeat" as const,
    };
    if (crop && crop.fw > 0 && crop.fw < 1 && crop.fh > 0 && crop.fh < 1) {
      // Recorte exato do sub-retângulo: escala o fundo p/ a célula preencher a
      // caixa e posiciona pelo canto (fórmula de % do CSS: p = f0 / (1 − f)).
      return {
        ...base,
        backgroundSize: `${100 / crop.fw}% ${100 / crop.fh}%`,
        backgroundPosition: `${(crop.fx / (1 - crop.fw)) * 100}% ${
          (crop.fy / (1 - crop.fh)) * 100
        }%`,
      };
    }
    return {
      ...base,
      backgroundSize: backgroundFit === "contain" ? "contain" : "cover",
      backgroundPosition: "center",
    };
  }
  if (backgroundGradient) {
    const g = backgroundGradient;
    if (crop && crop.fh > 0 && crop.fh < 1) {
      return {
        backgroundImage: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})`,
        backgroundSize: `100% ${100 / crop.fh}%`,
        backgroundPosition: `50% ${(crop.fy / (1 - crop.fh)) * 100}%`,
        backgroundRepeat: "no-repeat",
      };
    }
    return {
      backgroundImage: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})`,
    };
  }
  const isWhite = ["#ffffff", "#fff", "white", ""].includes(
    (backgroundColor ?? "").toLowerCase().trim(),
  );
  return isWhite ? null : { backgroundColor };
}

// Caixa (px) do card DENTRO de um container maior — p/ o editor livre, onde o
// card é uma sub-região central e o resto do container mostra o CONTEXTO da
// página ao redor.
export type CardBox = {
  containerW: number;
  containerH: number;
  cardLeft: number;
  cardTop: number;
  cardW: number;
  cardH: number;
};

// Fundo do editor livre = "janela" para a página: escala o fundo de modo que a
// célula do card ocupe exatamente a caixa `box` (cardW×cardH) e o restante da
// página apareça ao redor, na mesma escala. Sem `crop` → fundo inteiro (cover).
export function pageWindowBg(
  config: PageBgConfig,
  crop: CropRect | null | undefined,
  box: CardBox,
): React.CSSProperties | null {
  if (!crop || crop.fw <= 0 || crop.fh <= 0 || box.cardW <= 0 || box.cardH <= 0)
    return cardPreviewBg(config, null);
  const { backgroundColor, backgroundGradient, backgroundImage } = config;
  if (backgroundImage) {
    const bgW = box.cardW / crop.fw;
    const bgH = box.cardH / crop.fh;
    return {
      backgroundColor: backgroundColor || undefined,
      backgroundImage: `url("${constructUrl(backgroundImage)}")`,
      backgroundSize: `${bgW}px ${bgH}px`,
      backgroundPosition: `${box.cardLeft - crop.fx * bgW}px ${
        box.cardTop - crop.fy * bgH
      }px`,
      backgroundRepeat: "no-repeat",
    };
  }
  if (backgroundGradient) {
    const g = backgroundGradient;
    const bgH = box.cardH / crop.fh;
    return {
      backgroundImage: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})`,
      backgroundSize: `100% ${bgH}px`,
      backgroundPosition: `50% ${box.cardTop - crop.fy * bgH}px`,
      backgroundRepeat: "no-repeat",
    };
  }
  const isWhite = ["#ffffff", "#fff", "white", ""].includes(
    (backgroundColor ?? "").toLowerCase().trim(),
  );
  return isWhite ? null : { backgroundColor };
}
