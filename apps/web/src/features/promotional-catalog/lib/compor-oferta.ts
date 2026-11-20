import { fundoEscuro, luminancia } from "@/features/storefront/lib/cores";
import { productIdsOnPage } from "./page-products";
import type {
  CardLayoutElement,
  CatalogConfig,
  CatalogPage,
  LayerRect,
  Overlay,
  ProductGroup,
  StyleBlock,
  TextElement,
} from "../types";

// Gerador de oferta — o COMPOSITOR. Lógica pura (sem React, sem prisma, sem IA).
//
// Recebe o que o assistente juntou (produtos, oferta, marca, estilo, formato) e
// devolve páginas de catálogo comuns: tudo continua editável no editor. A IA
// (Fase 3) só vai ESCOLHER os parâmetros deste compositor — molde, clima, cores,
// chamada — e nunca desenhar livre; é o que mantém o resultado legível e
// testável sem modelo.

export type FormatoOferta = "a4" | "story" | "feed";
export type ClimaOferta =
  | "impacto"
  | "feira"
  | "elegante"
  | "minimalista"
  | "datas";
export type MoldeOferta = "grade" | "destaque";

export const FORMATOS_OFERTA: {
  value: FormatoOferta;
  label: string;
  detalhe: string;
}[] = [
  { value: "a4", label: "Encarte A4", detalhe: "Retrato, para imprimir" },
  { value: "story", label: "Story 9:16", detalhe: "Instagram e WhatsApp" },
  { value: "feed", label: "Feed 4:5", detalhe: "Post do Instagram" },
];

export const CLIMAS_OFERTA: {
  value: ClimaOferta;
  label: string;
  corPadrao: string;
}[] = [
  { value: "impacto", label: "Impacto varejo", corPadrao: "#d50000" },
  { value: "feira", label: "Feira / hortifruti", corPadrao: "#2e7d32" },
  { value: "elegante", label: "Elegante", corPadrao: "#c9a227" },
  { value: "minimalista", label: "Minimalista", corPadrao: "#0676b7" },
  { value: "datas", label: "Datas especiais", corPadrao: "#6a1b9a" },
];

const LARGURA = 1080;

// Proporção (largura ÷ altura) de cada formato e o `pageSize` que o editor
// entende. A4 e Feed usam `pageAspect`, que sobrepõe o preset.
const PAGINA: Record<
  FormatoOferta,
  { pageSize: CatalogConfig["pageSize"]; pageAspect?: number }
> = {
  a4: { pageSize: "portrait", pageAspect: 1 / Math.SQRT2 },
  story: { pageSize: "story" },
  feed: { pageSize: "portrait", pageAspect: 0.8 },
};

/** Quantos produtos cabem numa página de cada formato, sem virar miniatura. */
export const LIMITE_POR_PAGINA: Record<FormatoOferta, number> = {
  a4: 12,
  story: 6,
  feed: 6,
};

/** O formato da oferta a partir de um catálogo existente (o formato é dele). */
export function formatoDoCatalogo(
  config: Pick<CatalogConfig, "pageSize" | "pageAspect">,
): FormatoOferta {
  if (config.pageSize === "story" && !config.pageAspect) return "story";
  if (config.pageAspect && Math.abs(config.pageAspect - 0.8) < 0.02)
    return "feed";
  return "a4";
}

export function alturaDaPagina(
  config: Pick<CatalogConfig, "pageSize" | "pageAspect">,
): number {
  if (config.pageAspect && config.pageAspect > 0)
    return Math.round(LARGURA / config.pageAspect);
  return { square: 1080, story: 1920, portrait: 1440 }[config.pageSize];
}

export type Paleta = {
  fundo: string;
  fundoAte: string;
  titulo: string;
  texto: string;
  card: string;
  cardTexto: string;
  destaque: string;
  destaqueTexto: string;
  fonte: string;
};

function hex2(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, "0");
}

function rgb(hex: string): number[] {
  const l = hex.replace("#", "");
  const f = l.length === 3 ? [...l].map((x) => x + x).join("") : l;
  return [0, 2, 4].map((i) => Number.parseInt(f.slice(i, i + 2), 16));
}

/** Mistura `hex` com `alvo` (0 = hex, 1 = alvo). */
export function misturar(hex: string, alvo: string, t: number): string {
  const a = rgb(hex);
  const b = rgb(alvo);
  return `#${a.map((v, i) => hex2(v + (b[i] - v) * t)).join("")}`;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

/**
 * Preto ou branco, o que contrastar MAIS. O `tintaSobre` da vitrine corta em
 * luminância 0,45, e em cores médias (dourado, cinza) isso escolhe o branco
 * com contraste abaixo de 3:1 — num preço, é o que não se lê.
 */
export function tintaLegivel(fundo: string): string {
  return contraste(fundo, "#111111") >= contraste(fundo, "#fafafa")
    ? "#111111"
    : "#fafafa";
}

/**
 * Paleta equilibrada do clima. A cor base entra onde o clima deixa, e os
 * textos saem SEMPRE de `tintaLegivel`: cor inválida ou clara demais nunca gera
 * texto ilegível — cai no padrão do clima.
 */
export function paletaDoClima(clima: ClimaOferta, corBase?: string): Paleta {
  const padrao =
    CLIMAS_OFERTA.find((c) => c.value === clima)?.corPadrao ?? "#d50000";
  const base = corBase && HEX.test(corBase) ? corBase : padrao;
  switch (clima) {
    case "feira": {
      const fundo = fundoEscuro(base) ? base : misturar(base, "#000000", 0.45);
      return {
        fundo,
        fundoAte: misturar(fundo, "#000000", 0.3),
        titulo: "#fff59d",
        texto: "#ffffff",
        card: "#ffffff",
        cardTexto: "#1b1b1b",
        destaque: "#e65100",
        destaqueTexto: "#ffffff",
        fonte: "'Trebuchet MS', sans-serif",
      };
    }
    case "elegante": {
      const destaque = luminancia(base) > 0.15 ? base : "#c9a227";
      return {
        fundo: "#141414",
        fundoAte: "#2a2a2a",
        titulo: destaque,
        texto: "#f5f1e6",
        card: "#faf7f0",
        cardTexto: "#1b1b1b",
        destaque,
        destaqueTexto: tintaLegivel(destaque),
        fonte: "Georgia, serif",
      };
    }
    case "minimalista": {
      // Sobre branco a cor precisa ser escura o bastante para o título.
      const destaque =
        luminancia(base) > 0.35 ? misturar(base, "#000000", 0.4) : base;
      return {
        fundo: "#ffffff",
        fundoAte: "#f3f4f6",
        titulo: destaque,
        texto: "#374151",
        card: "#f5f5f5",
        cardTexto: "#111111",
        destaque,
        destaqueTexto: tintaLegivel(destaque),
        fonte: "Inter, sans-serif",
      };
    }
    case "datas": {
      const fundo = fundoEscuro(base) ? base : misturar(base, "#000000", 0.4);
      return {
        fundo,
        fundoAte: misturar(fundo, "#ffffff", 0.2),
        titulo: "#ffffff",
        texto: "#ffffff",
        card: "#ffffff",
        cardTexto: "#1b1b1b",
        destaque: "#ffe600",
        destaqueTexto: "#111111",
        fonte: "'Arial Black', sans-serif",
      };
    }
    default: {
      const fundo = base;
      const escuro = fundoEscuro(fundo);
      // Preço em vermelho, a não ser que o fundo já seja vermelho — aí o
      // amarelo de encarte separa o preço do fundo.
      const [r, g, b] = rgb(fundo);
      const fundoVermelho = r > 150 && g < 90 && b < 90;
      return {
        fundo,
        fundoAte: misturar(fundo, "#000000", 0.35),
        titulo: escuro ? "#ffe600" : "#111111",
        texto: tintaLegivel(fundo),
        card: "#ffffff",
        cardTexto: "#111111",
        destaque: fundoVermelho ? "#ffe600" : "#e30613",
        destaqueTexto: fundoVermelho ? "#111111" : "#ffffff",
        fonte: "'Arial Black', sans-serif",
      };
    }
  }
}

/** Proporção do card de oferta: vertical, foto em cima e preço embaixo. */
export const PROPORCAO_CARD_OFERTA = 0.78;

/** A etiqueta do card de oferta, pintada com a paleta. */
export function etiquetaDeOferta(p: Paleta): CardLayoutElement[] {
  const base = {
    rotation: 0,
    opacity: 1,
    fill: p.destaque,
    fontFamily: p.fonte,
  };
  return [
    {
      ...base,
      id: "oferta-fundo",
      kind: "shape",
      shape: "rect",
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      z: -1,
      fill: p.card,
      color: p.cardTexto,
      radius: 0.04,
    },
    {
      ...base,
      id: "oferta-foto",
      kind: "var",
      variable: "photo",
      x: 0.06,
      y: 0.04,
      w: 0.88,
      h: 0.5,
      z: 0,
      color: p.cardTexto,
    },
    {
      ...base,
      id: "oferta-nome",
      kind: "var",
      variable: "name",
      x: 0.05,
      y: 0.55,
      w: 0.9,
      h: 0.13,
      z: 1,
      align: "center",
      color: p.cardTexto,
      fontFrac: 0.05,
      fontWeight: 700,
      fontFamily: "Inter, sans-serif",
    },
    {
      ...base,
      id: "oferta-de",
      kind: "var",
      variable: "priceFrom",
      x: 0.1,
      y: 0.685,
      w: 0.8,
      h: 0.07,
      z: 1,
      align: "center",
      color: misturar(p.cardTexto, p.card, 0.45),
      fontFrac: 0.04,
      fontWeight: 600,
      fontFamily: "Inter, sans-serif",
    },
    {
      ...base,
      id: "oferta-caixa-preco",
      kind: "shape",
      shape: "rect",
      x: 0.07,
      y: 0.765,
      w: 0.86,
      h: 0.2,
      z: 1,
      fill: p.destaque,
      color: p.destaqueTexto,
      radius: 0.04,
    },
    {
      ...base,
      id: "oferta-rs",
      kind: "var",
      variable: "priceCurrency",
      x: 0.1,
      y: 0.79,
      w: 0.15,
      h: 0.08,
      z: 2,
      align: "left",
      color: p.destaqueTexto,
      fontFrac: 0.045,
      fontWeight: 800,
    },
    {
      ...base,
      id: "oferta-reais",
      kind: "var",
      variable: "priceReais",
      x: 0.22,
      y: 0.765,
      w: 0.46,
      h: 0.2,
      z: 2,
      align: "right",
      color: p.destaqueTexto,
      fontFrac: 0.14,
      fontWeight: 900,
    },
    {
      ...base,
      id: "oferta-centavos",
      kind: "var",
      variable: "priceCents",
      x: 0.68,
      y: 0.78,
      w: 0.22,
      h: 0.1,
      z: 2,
      align: "left",
      color: p.destaqueTexto,
      fontFrac: 0.065,
      fontWeight: 900,
    },
    {
      ...base,
      id: "oferta-unidade",
      kind: "var",
      variable: "unit",
      x: 0.68,
      y: 0.875,
      w: 0.22,
      h: 0.07,
      z: 2,
      align: "left",
      color: p.destaqueTexto,
      fontFrac: 0.035,
      fontWeight: 700,
    },
  ];
}

const GAP = 20;

/**
 * A grade que deixa os cards MAIORES dentro do retângulo: testa de 1 a 5
 * colunas e fica com a que dá o card mais largo sem estourar a altura.
 * A grade é centralizada — sobra de largura vira margem, não card esticado.
 */
export function encaixarGrade(
  n: number,
  area: LayerRect,
  proporcao: number,
): { cols: number; rows: number; rect: LayerRect } {
  let melhor = { cols: 1, rows: Math.max(1, n), card: 0 };
  for (let cols = 1; cols <= Math.min(5, Math.max(1, n)); cols++) {
    const rows = Math.ceil(n / cols);
    const pelaLargura = (area.w - (cols - 1) * GAP) / cols;
    const pelaAltura = ((area.h - (rows - 1) * GAP) / rows) * proporcao;
    const card = Math.min(pelaLargura, pelaAltura);
    if (card > melhor.card) melhor = { cols, rows, card };
  }
  const w = melhor.cols * melhor.card + (melhor.cols - 1) * GAP;
  const h = melhor.rows * (melhor.card / proporcao) + (melhor.rows - 1) * GAP;
  return {
    cols: melhor.cols,
    rows: melhor.rows,
    rect: {
      x: Math.round(area.x + (area.w - w) / 2),
      y: Math.round(area.y + Math.max(0, (area.h - h) / 2)),
      w: Math.round(w),
      h: Math.round(h),
    },
  };
}

export type EntradaOferta = {
  formato: FormatoOferta;
  /** Na ordem escolhida; o primeiro é o destaque no molde "destaque". */
  produtoIds: string[];
  /** Preço "Por" digitado na conferência (vira `offerOverrides`). */
  precosPor?: Record<string, number>;
  oferta: {
    nome: string;
    chamada?: string;
    /** datetime-local, ex.: "2026-10-31T23:59". */
    validade?: string;
    informacoes?: string[];
    contato?: string;
  };
  /** Chave R2 ou URL do logo; `org` usa o logo da organização (dinâmico). */
  logo?: { tipo: "asset"; chave: string } | { tipo: "org" } | null;
  clima: ClimaOferta;
  corBase?: string;
  molde: MoldeOferta;
  /**
   * Dentro de um catálogo aberto: a proporção do card é a dele e a etiqueta
   * também — a de oferta é vertical e sairia achatada no card de outro
   * catálogo. Ausente = catálogo novo, com a etiqueta de oferta.
   */
  proporcaoCard?: number;
  /**
   * Arte da página gerada por IA (chave no R2). Presente = molde PREMIUM: a
   * arte é o fundo (título em 3D, papel rasgado, faixa de rodapé) e o
   * compositor só põe por cima o que precisa ser exato — foto real, nome,
   * preço e validade. Ver `ZONAS_DA_ARTE`.
   */
  arte?: string;
  /**
   * Etiqueta de preço SALVA pela organização (biblioteca da aba "Etiqueta").
   * Ausente = a etiqueta de oferta automática, pintada com a paleta.
   * `proporcao` é a do card em que ela foi desenhada — sem ela, o desenho
   * esticaria.
   */
  etiqueta?: { layout: CardLayoutElement[]; proporcao: number };
  gerarId?: () => string;
};

export type OfertaComposta = {
  pages: CatalogPage[];
  paleta: Paleta;
  /** Campos globais do catálogo NOVO (formato, card). */
  configBase: Partial<CatalogConfig>;
  offerOverrides: Record<string, number>;
};

/** Quantas linhas o texto ocupa quebrando por palavra, `porLinha` letras cada. */
function contarLinhas(texto: string, porLinha: number): number {
  if (porLinha <= 0) return Number.POSITIVE_INFINITY;
  let linhas = 1;
  let atual = 0;
  for (const palavra of texto.trim().split(/\s+/)) {
    // Palavra maior que a linha nunca cabe: quebraria no meio.
    if (palavra.length > porLinha) return Number.POSITIVE_INFINITY;
    const com = atual === 0 ? palavra.length : atual + 1 + palavra.length;
    if (com > porLinha) {
      linhas++;
      atual = palavra.length;
    } else atual = com;
  }
  return linhas;
}

/**
 * O maior corpo de fonte em que o texto cabe na largura em até `maxLinhas`.
 *
 * Sem medir fonte de verdade (o compositor roda no servidor, sem canvas): a
 * largura de uma letra é estimada por `fator` × corpo — ~0,8 para caixa alta
 * em fonte pesada, ~0,55 para texto corrido. Prefere UMA linha até ~70% do
 * corpo cheio; abaixo disso, título grande em duas linhas lê melhor que
 * miúdo em uma.
 */
export function caberNaCaixa(
  texto: string,
  largura: number,
  fonteMax: number,
  fator: number,
  maxLinhas: number,
  fonteMin = 24,
): { fonte: number; linhas: number } {
  const linhasEm = (fonte: number) =>
    contarLinhas(texto, Math.floor(largura / (fonte * fator)));
  for (let fonte = fonteMax; fonte >= Math.round(fonteMax * 0.7); fonte -= 2)
    if (linhasEm(fonte) === 1) return { fonte, linhas: 1 };
  for (let fonte = fonteMax; fonte >= fonteMin; fonte -= 2) {
    const linhas = linhasEm(fonte);
    if (linhas <= maxLinhas) return { fonte, linhas };
  }
  return { fonte: fonteMin, linhas: Math.min(maxLinhas, linhasEm(fonteMin)) };
}

/** "2026-10-31T23:59" → "31/10". Inválida → null. */
export function dataCurta(validade?: string): string | null {
  const m = validade?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : null;
}

function fatiar<T>(lista: readonly T[], tamanho: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho)
    out.push(lista.slice(i, i + tamanho));
  return out;
}

export function comporOferta(e: EntradaOferta): OfertaComposta {
  if (e.arte) return comporOfertaComArte({ ...e, arte: e.arte });
  const id = e.gerarId ?? (() => crypto.randomUUID());
  const { pageSize, pageAspect } = PAGINA[e.formato];
  const H = alturaDaPagina({ pageSize, pageAspect });
  const p = paletaDoClima(e.clima, e.corBase);
  const proporcao =
    e.etiqueta?.proporcao ?? e.proporcaoCard ?? PROPORCAO_CARD_OFERTA;
  const story = e.formato === "story";

  // Faixas da página: cabeçalho, produtos, rodapé — em fração da altura.
  const topoY = story ? 0.08 * H : 0.035 * H;
  const temLogo = !!e.logo;
  const logoH = temLogo ? Math.round((story ? 0.085 : 0.075) * H) : 0;
  const larguraTexto = LARGURA - 80;
  const fonteDoTitulo = story ? 120 : e.formato === "feed" ? 96 : 104;
  const caixaAlta = e.clima !== "elegante";
  const titulo = caberNaCaixa(
    e.oferta.nome.trim() || "Ofertas",
    larguraTexto,
    fonteDoTitulo,
    caixaAlta ? 0.8 : 0.6,
    2,
    48,
  );
  const tituloY = topoY + (temLogo ? logoH + 12 : 0);
  const tituloH = Math.round(titulo.linhas * titulo.fonte * 1.08);
  const chamada = e.oferta.chamada?.trim()
    ? caberNaCaixa(
        e.oferta.chamada.trim(),
        larguraTexto,
        Math.round(fonteDoTitulo * 0.36),
        0.56,
        2,
      )
    : null;
  const chamadaY = tituloY + tituloH + 8;
  const chamadaH = chamada
    ? Math.round(chamada.linhas * chamada.fonte * 1.3)
    : 0;
  const produtosY = chamadaY + chamadaH + 24;
  const rodapeH = Math.round((story ? 0.13 : 0.1) * H);
  const rodapeY = H - rodapeH - (story ? 0.04 * H : 0.02 * H);
  const area: LayerRect = {
    x: 50,
    y: Math.round(produtosY),
    w: LARGURA - 100,
    h: Math.round(rodapeY - produtosY - 16),
  };

  const cabecalho = (): { overlays: Overlay[]; texts: TextElement[] } => {
    const overlays: Overlay[] = [];
    if (e.logo) {
      const w = Math.round(logoH * 2.4);
      overlays.push({
        id: id(),
        assetKey: e.logo.tipo === "asset" ? e.logo.chave : "",
        ...(e.logo.tipo === "org"
          ? { binding: { source: "org", variable: "org.logo" } as const }
          : {}),
        x: Math.round((LARGURA - w) / 2),
        y: Math.round(topoY),
        w,
        h: logoH,
        rotation: 0,
      });
    }
    const texto = (
      over: Partial<TextElement> &
        Pick<TextElement, "text" | "y" | "h" | "fontSize">,
    ): TextElement => ({
      id: id(),
      x: 40,
      w: LARGURA - 80,
      rotation: 0,
      fontFamily: p.fonte,
      color: p.texto,
      align: "center",
      anchor: "middle",
      ...over,
    });
    const texts: TextElement[] = [
      texto({
        text: e.oferta.nome.trim() || "Ofertas",
        y: Math.round(tituloY),
        h: tituloH,
        fontSize: titulo.fonte,
        color: p.titulo,
        bold: true,
        uppercase: caixaAlta,
        lineHeight: 1,
      }),
    ];
    if (e.oferta.chamada?.trim() && chamada)
      texts.push(
        texto({
          text: e.oferta.chamada.trim(),
          y: Math.round(chamadaY),
          h: chamadaH,
          fontSize: chamada.fonte,
          lineHeight: 1.2,
          bold: true,
          fontFamily: "Inter, sans-serif",
        }),
      );

    const data = dataCurta(e.oferta.validade);
    const linhas = [
      data ? `Ofertas válidas até ${data}` : null,
      e.oferta.contato?.trim() ? e.oferta.contato.trim() : null,
    ].filter((l): l is string => !!l);
    const info = (e.oferta.informacoes ?? [])
      .map((i) => i.trim())
      .filter(Boolean)
      .join(" • ");
    if (linhas.length > 0)
      texts.push(
        texto({
          text: linhas.join("  |  "),
          y: Math.round(rodapeY),
          h: Math.round(rodapeH * 0.55),
          fontSize: story ? 40 : 34,
          bold: true,
          fontFamily: "Inter, sans-serif",
          boxed: true,
          boxFill: p.destaque,
          boxRadius: 16,
          color: p.destaqueTexto,
        }),
      );
    if (info)
      texts.push(
        texto({
          text: info,
          y: Math.round(rodapeY + rodapeH * 0.6),
          h: Math.round(rodapeH * 0.4),
          fontSize: story ? 26 : 22,
          fontFamily: "Inter, sans-serif",
        }),
      );
    return { overlays, texts };
  };

  const limite = LIMITE_POR_PAGINA[e.formato];
  const ids = [...new Set(e.produtoIds)];
  const lotes = ids.length > 0 ? fatiar(ids, limite) : [[]];
  const etiqueta = e.etiqueta?.layout ?? etiquetaDeOferta(p);

  const pages: CatalogPage[] = lotes.map((lote, i) => {
    let grupos: ProductGroup[];
    const destaque = e.molde === "destaque" && i === 0 && lote.length >= 2;
    if (destaque) {
      // Herói em cima (≈55% da área) e o resto em grade embaixo.
      const alturaHeroi = Math.round(area.h * 0.55);
      const heroi = encaixarGrade(
        1,
        { ...area, h: alturaHeroi - GAP / 2 },
        proporcao,
      );
      const resto = encaixarGrade(
        lote.length - 1,
        {
          ...area,
          y: area.y + alturaHeroi + GAP / 2,
          h: area.h - alturaHeroi - GAP / 2,
        },
        proporcao,
      );
      grupos = [
        {
          id: id(),
          name: "Destaque",
          rect: heroi.rect,
          gridCols: 1,
          gridRows: 1,
          productIds: [lote[0]],
          gap: GAP,
        },
        {
          id: id(),
          name: "Ofertas",
          rect: resto.rect,
          gridCols: resto.cols,
          gridRows: resto.rows,
          productIds: lote.slice(1),
          gap: GAP,
        },
      ];
    } else {
      const g = encaixarGrade(Math.max(1, lote.length), area, proporcao);
      grupos = [
        {
          id: id(),
          name: "Ofertas",
          rect: g.rect,
          gridCols: g.cols,
          gridRows: g.rows,
          productIds: lote,
          gap: GAP,
        },
      ];
    }
    const { overlays, texts } = cabecalho();
    return {
      id: id(),
      name:
        lotes.length > 1
          ? `${e.oferta.nome.trim() || "Oferta"} ${i + 1}`
          : e.oferta.nome.trim() || "Oferta",
      locked: false,
      layout: "custom",
      gridCols: grupos[grupos.length - 1].gridCols,
      gridRows: grupos[grupos.length - 1].gridRows,
      productGroups: grupos,
      productIds: lote,
      backgroundColor: p.fundo,
      backgroundGradient: { from: p.fundo, to: p.fundoAte, angle: 180 },
      backgroundImage: "",
      backgroundFit: "cover",
      overlays,
      texts,
      styleBlocks: [],
      // Etiqueta escolhida vale sempre; a automática só no catálogo novo
      // (dentro de um catálogo aberto fica a etiqueta dele).
      ...(e.etiqueta || !e.proporcaoCard ? { cardLayout: etiqueta } : {}),
      ...(e.oferta.validade ? { offerValidUntil: e.oferta.validade } : {}),
    };
  });

  const offerOverrides = Object.fromEntries(
    Object.entries(e.precosPor ?? {}).filter(
      ([pid, v]) => ids.includes(pid) && Number.isFinite(v) && v > 0,
    ),
  );

  return {
    pages,
    paleta: p,
    offerOverrides,
    configBase: {
      pageSize,
      pageAspect,
      cardLayout: etiqueta,
      cardLayoutOverrides: {},
      cardAspectRatio: proporcao,
      backgroundImage: "",
      backgroundColor: p.fundo,
      showTitle: false,
      showSubtitle: false,
      showFooter: false,
      productGroup: undefined,
      productGroups: undefined,
      productGroupScale: 1,
      ...(e.oferta.validade ? { offerValidUntil: e.oferta.validade } : {}),
    },
  };
}

/** Catálogo NOVO com a oferta. */
export function catalogoDaOferta(
  padrao: CatalogConfig,
  oferta: OfertaComposta,
): CatalogConfig {
  const ids = [...new Set(oferta.pages.flatMap(productIdsOnPage))];
  return {
    ...padrao,
    ...oferta.configBase,
    pages: oferta.pages,
    manuallyAddedIds: ids,
    productOrder: ids,
    offerOverrides: oferta.offerOverrides,
  };
}

/**
 * Páginas da oferta ACRESCENTADAS a um catálogo aberto. Os produtos entram no
 * catálogo (e saem do "excluídos", se estavam lá); o formato e o estilo global
 * do catálogo não mudam — a etiqueta de oferta vai por página.
 */
export function acrescentarOferta(
  config: CatalogConfig,
  paginasAtuais: CatalogPage[],
  oferta: OfertaComposta,
): CatalogConfig {
  const ids = [...new Set(oferta.pages.flatMap(productIdsOnPage))];
  const novos = new Set(ids);
  return {
    ...config,
    pages: [...paginasAtuais, ...oferta.pages],
    manuallyAddedIds: [
      ...new Set([...(config.manuallyAddedIds ?? []), ...ids]),
    ],
    excludedProductIds: (config.excludedProductIds ?? []).filter(
      (pid) => !novos.has(pid),
    ),
    offerOverrides: {
      ...(config.offerOverrides ?? {}),
      ...oferta.offerOverrides,
    },
  };
}

// ── Molde premium: arte da IA + dados por cima ──────────────────────────────

/**
 * Onde cada coisa mora na arte, em fração da altura da página. O prompt da
 * arte (`server/gerar-arte.ts`) pede ESTAS faixas vazias, e o compositor põe
 * os dados nelas — as duas pontas leem daqui para nunca discordarem.
 */
export const ZONAS_DA_ARTE = {
  titulo: { de: 0, ate: 0.27 },
  produtos: { de: 0.29, ate: 0.8 },
  informacoes: { de: 0.8, ate: 0.845 },
  rodape: { de: 0.855, ate: 0.985 },
} as const;

/**
 * A etiqueta do produto em DESTAQUE (um só na página): foto à esquerda
 * ocupando a altura toda, e à direita a faixa branca com o nome e o box do
 * preço — o arranjo do encarte de referência. Sem fundo de card: pousa
 * direto na arte.
 */
export function etiquetaHeroi(p: Paleta): CardLayoutElement[] {
  const base = { rotation: 0, opacity: 1, fontFamily: p.fonte };
  return [
    {
      ...base,
      id: "heroi-foto",
      kind: "var",
      variable: "photo",
      x: 0,
      y: 0,
      w: 0.5,
      h: 1,
      z: 0,
      color: p.cardTexto,
      fill: "transparent",
    },
    {
      ...base,
      id: "heroi-faixa",
      kind: "shape",
      shape: "rect",
      x: 0.52,
      y: 0.08,
      w: 0.48,
      h: 0.26,
      z: 1,
      fill: "#ffffff",
      color: p.cardTexto,
      radius: 0.02,
    },
    {
      ...base,
      id: "heroi-nome",
      kind: "var",
      variable: "name",
      x: 0.54,
      y: 0.09,
      w: 0.44,
      h: 0.24,
      z: 2,
      align: "center",
      color: "#14532d",
      fill: "#ffffff",
      fontFrac: 0.055,
      fontWeight: 900,
    },
    {
      ...base,
      id: "heroi-caixa-preco",
      kind: "shape",
      shape: "rect",
      x: 0.52,
      y: 0.4,
      w: 0.48,
      h: 0.34,
      z: 1,
      fill: p.destaque,
      color: p.destaqueTexto,
      radius: 0.04,
      outlineWidth: 0.008,
      outlineColor: p.titulo,
    },
    {
      ...base,
      id: "heroi-rs",
      kind: "var",
      variable: "priceCurrency",
      x: 0.55,
      y: 0.46,
      w: 0.1,
      h: 0.1,
      z: 2,
      align: "left",
      color: p.destaqueTexto,
      fill: p.destaque,
      fontFrac: 0.06,
      fontWeight: 900,
    },
    {
      ...base,
      id: "heroi-reais",
      kind: "var",
      variable: "priceReais",
      x: 0.58,
      y: 0.41,
      w: 0.25,
      h: 0.32,
      z: 2,
      align: "right",
      color: p.destaqueTexto,
      fill: p.destaque,
      fontFrac: 0.24,
      fontWeight: 900,
    },
    {
      ...base,
      id: "heroi-centavos",
      kind: "var",
      variable: "priceCents",
      x: 0.83,
      y: 0.44,
      w: 0.16,
      h: 0.12,
      z: 2,
      align: "left",
      color: p.destaqueTexto,
      fill: p.destaque,
      fontFrac: 0.075,
      fontWeight: 900,
    },
    {
      ...base,
      id: "heroi-de",
      kind: "var",
      variable: "priceFrom",
      x: 0.52,
      y: 0.78,
      w: 0.48,
      h: 0.08,
      z: 2,
      align: "center",
      color: "#ffffff",
      fill: "transparent",
      fontFrac: 0.045,
      fontWeight: 700,
      fontFamily: "Inter, sans-serif",
    },
  ];
}

export function comporOfertaComArte(
  e: EntradaOferta & { arte: string },
): OfertaComposta {
  const id = e.gerarId ?? (() => crypto.randomUUID());
  const { pageSize, pageAspect } = PAGINA[e.formato];
  const H = alturaDaPagina({ pageSize, pageAspect });
  const p = paletaDoClima(e.clima, e.corBase);
  const faixa = (z: { de: number; ate: number }) => ({
    y: Math.round(z.de * H),
    h: Math.round((z.ate - z.de) * H),
  });
  const zProdutos = faixa(ZONAS_DA_ARTE.produtos);
  const zInfo = faixa(ZONAS_DA_ARTE.informacoes);
  const zRodape = faixa(ZONAS_DA_ARTE.rodape);
  const area: LayerRect = {
    x: 40,
    y: zProdutos.y,
    w: LARGURA - 80,
    h: zProdutos.h,
  };

  const limite = LIMITE_POR_PAGINA[e.formato];
  const ids = [...new Set(e.produtoIds)];
  const lotes = ids.length > 0 ? fatiar(ids, limite) : [[]];
  const cardLayout = e.etiqueta?.layout ?? etiquetaDeOferta(p);
  const proporcao = e.etiqueta?.proporcao ?? PROPORCAO_CARD_OFERTA;

  const textoBase = (
    over: Partial<TextElement> &
      Pick<TextElement, "text" | "x" | "y" | "w" | "h" | "fontSize">,
  ): TextElement => ({
    id: id(),
    rotation: 0,
    fontFamily: "'Arial Black', sans-serif",
    color: "#ffffff",
    align: "center",
    anchor: "middle",
    bold: true,
    uppercase: true,
    lineHeight: 1.05,
    ...over,
  });

  const data = dataCurta(e.oferta.validade);
  const ano = e.oferta.validade?.slice(0, 4);
  const metade = (LARGURA - 80) / 2;
  const rodape = (): TextElement[] => {
    const t: TextElement[] = [];
    // Duas metades da faixa escura da arte: validade à esquerda, chamada de
    // ação à direita. A arte vem SEM ícones nem texto ali — ícone desenhado
    // pela IA não tem posição garantida e acabava por baixo das letras.
    const meia = { w: metade - 20, h: Math.round(zRodape.h / 2) };
    if (data) {
      t.push(
        textoBase({
          text: "Válida até o dia",
          x: 50,
          y: zRodape.y + Math.round(zRodape.h * 0.12),
          w: meia.w,
          h: Math.round(zRodape.h * 0.3),
          fontSize: 30,
          fontFamily: "Inter, sans-serif",
        }),
        textoBase({
          text: `${data.replace("/", ".")}${ano ? `.${ano}` : ""}`,
          x: 50,
          y: zRodape.y + Math.round(zRodape.h * 0.4),
          w: meia.w,
          h: Math.round(zRodape.h * 0.48),
          fontSize: 64,
          color: "#ffd400",
        }),
      );
    }
    t.push(
      textoBase({
        text: e.oferta.contato?.trim() || "Corra e garanta o seu!",
        x: 40 + metade + 10,
        y: zRodape.y + Math.round(zRodape.h * 0.1),
        w: meia.w,
        h: Math.round(zRodape.h * 0.8),
        fontSize: 46,
        color: "#ffd400",
      }),
    );
    const info = (e.oferta.informacoes ?? [])
      .map((i) => i.trim())
      .filter(Boolean)
      .join(" • ");
    if (info)
      t.push(
        textoBase({
          text: info,
          x: 40,
          y: zInfo.y,
          w: LARGURA - 80,
          h: zInfo.h,
          fontSize: 24,
          fontFamily: "Inter, sans-serif",
          uppercase: false,
          bold: false,
        }),
      );
    return t;
  };

  const logo = (): Overlay[] => {
    if (!e.logo) return [];
    // Canto superior direito: o prompt da arte deixa esse canto livre.
    const h = Math.round(0.07 * H);
    const w = Math.round(h * 2.2);
    return [
      {
        id: id(),
        assetKey: e.logo.tipo === "asset" ? e.logo.chave : "",
        ...(e.logo.tipo === "org"
          ? { binding: { source: "org", variable: "org.logo" } as const }
          : {}),
        x: LARGURA - w - 30,
        y: Math.round(0.02 * H),
        w,
        h,
        rotation: 0,
      },
    ];
  };

  const pages: CatalogPage[] = lotes.map((lote, i) => {
    let blocos: StyleBlock[];
    if (lote.length === 1 && !e.etiqueta) {
      blocos = [
        {
          id: id(),
          x: area.x,
          y: area.y,
          w: area.w,
          h: area.h,
          rotation: 0,
          productId: lote[0],
          cardLayout: etiquetaHeroi(p),
        },
      ];
    } else {
      // Etiqueta salva: o produto único também usa ela, só que grande —
      // a grade de 1 célula ocupa a zona inteira na proporção do desenho.
      const g = encaixarGrade(lote.length, area, proporcao);
      const cw = (g.rect.w - (g.cols - 1) * GAP) / g.cols;
      const ch = cw / proporcao;
      blocos = lote.map((pid, k) => {
        const col = k % g.cols;
        const lin = Math.floor(k / g.cols);
        // Última linha incompleta centralizada.
        const naLinha = Math.min(g.cols, lote.length - lin * g.cols);
        const sobra = (g.cols - naLinha) * (cw + GAP);
        return {
          id: id(),
          x: Math.round(g.rect.x + sobra / 2 + col * (cw + GAP)),
          y: Math.round(g.rect.y + lin * (ch + GAP)),
          w: Math.round(cw),
          h: Math.round(ch),
          rotation: 0,
          productId: pid,
          cardLayout,
        };
      });
    }
    return {
      id: id(),
      name:
        lotes.length > 1
          ? `${e.oferta.nome.trim() || "Oferta"} ${i + 1}`
          : e.oferta.nome.trim() || "Oferta",
      locked: false,
      layout: "custom",
      gridCols: 1,
      gridRows: 1,
      // Produtos só nos blocos: `[]` explícito tira a grade da página.
      productIds: [],
      productGroups: [],
      backgroundColor: p.fundo,
      backgroundImage: e.arte,
      backgroundFit: "cover",
      overlays: logo(),
      texts: rodape(),
      styleBlocks: blocos,
      ...(e.oferta.validade ? { offerValidUntil: e.oferta.validade } : {}),
    };
  });

  const offerOverrides = Object.fromEntries(
    Object.entries(e.precosPor ?? {}).filter(
      ([pid, v]) => ids.includes(pid) && Number.isFinite(v) && v > 0,
    ),
  );

  return {
    pages,
    paleta: p,
    offerOverrides,
    configBase: {
      pageSize,
      pageAspect,
      // A etiqueta automática desenha o próprio fundo de card; a salva conta
      // com o fundo do card do catálogo, como no editor.
      hideCardBackground: !e.etiqueta,
      hideImageBackground: true,
      hideImageBorder: true,
      hideImageShadow: true,
      backgroundImage: e.arte,
      backgroundColor: p.fundo,
      showTitle: false,
      showSubtitle: false,
      showFooter: false,
      productGroup: undefined,
      productGroups: undefined,
      productGroupScale: 1,
      ...(e.oferta.validade ? { offerValidUntil: e.oferta.validade } : {}),
    },
  };
}
