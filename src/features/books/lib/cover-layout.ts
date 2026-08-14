// Layout livre de capa, página final e páginas de PDV do Book — array de
// elementos posicionáveis (texto, imagem, divisor, forma, slot de foto) num
// canvas fixo 16:9, editado no canvas Konva e renderizado de volta no PDF
// (react-pdf) via posição absoluta. Compartilhado entre client (editor) e
// server (geração do PDF).

export type CoverElementType =
  | "text"
  | "image"
  | "divider"
  | "shape"
  | "photoSlot";

interface CoverElementBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

// Restrito às três famílias embutidas no react-pdf. Qualquer outra exigiria
// registrar o TTF via Font.register antes de gerar o PDF — sem isso o editor
// mostra uma fonte e o PDF sai com outra.
export const BOOK_FONT_FAMILIES = [
  { value: "Helvetica", label: "Helvetica (sem serifa)" },
  { value: "Times-Roman", label: "Times (com serifa)" },
  { value: "Courier", label: "Courier (monoespaçada)" },
] as const;

export type BookFontFamily = (typeof BOOK_FONT_FAMILIES)[number]["value"];

export const DEFAULT_FONT_FAMILY: BookFontFamily = "Helvetica";

export interface CoverTextElement extends CoverElementBase {
  type: "text";
  // Pode conter tokens de variável ({{gerente}}, {{secao}}…) resolvidos por
  // item de PDV na geração do PDF — ver lib/book-variables.ts.
  text: string;
  fontSize: number;
  color: string;
  fontWeight: "normal" | "bold";
  align: "left" | "center" | "right";
  uppercase: boolean;
  fontFamily?: BookFontFamily;
}

// De onde vem a imagem. "upload" usa o `imageKey`; as outras duas resolvem o
// logo na hora de renderizar, então a capa padrão já sai preenchida e continua
// certa se a organização ou a indústria trocarem de logo depois.
export type CoverImageSource = "upload" | "organization" | "supplier";

export interface CoverImageElement extends CoverElementBase {
  type: "image";
  imageKey: string;
  imageSource?: CoverImageSource;
  objectFit: "contain" | "cover";
}

// Resolve a key final de um elemento de imagem. `logos` traz as keys do R2 da
// organização e da indústria do book.
export function resolveImageKey(
  element: CoverImageElement,
  logos?: { organization?: string | null; supplier?: string | null },
): string {
  if (element.imageSource === "organization") return logos?.organization ?? "";
  if (element.imageSource === "supplier") return logos?.supplier ?? "";
  return element.imageKey;
}

export interface CoverDividerElement extends CoverElementBase {
  type: "divider";
  color: string;
}

export type CoverShapeKind = "rect" | "rounded" | "circle" | "triangle";

export interface CoverShapeElement extends CoverElementBase {
  type: "shape";
  shape: CoverShapeKind;
  fill: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  // Texto opcional centralizado dentro da forma — cobre "retângulo com o nome
  // da seção dentro" sem precisar empilhar dois elementos e mantê-los
  // alinhados manualmente.
  text: string;
  fontSize: number;
  fontColor: string;
  fontFamily?: BookFontFamily;
  fontWeight: "normal" | "bold";
}

// Espaço reservado para a Nth foto do PDV daquela página. Só faz sentido em
// layout de página, onde o mesmo template é aplicado a todos os itens do book
// e cada item traz as próprias fotos.
export interface CoverPhotoSlotElement extends CoverElementBase {
  type: "photoSlot";
  slotIndex: number;
  objectFit: "contain" | "cover";
  cornerRadius: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeDashed?: boolean;
  // Zoom da foto dentro do espaço: 1 = enquadramento normal, 1.4 = 40% maior
  // (as bordas saem do campo). Serve pra aproximar um detalhe sem recortar o
  // arquivo original.
  imageScale?: number;
  // Recorte: ponto da foto que fica centralizado no espaço, em % (50/50 = meio).
  imageOffsetX?: number;
  imageOffsetY?: number;
}

export type CoverElement =
  | CoverTextElement
  | CoverImageElement
  | CoverDividerElement
  | CoverShapeElement
  | CoverPhotoSlotElement;

export const COVER_CANVAS_WIDTH = 960;
export const COVER_CANVAS_HEIGHT = 540;

export interface CoverBackground {
  color: string;
  opacity: number; // 0-1
  // Key R2 da imagem de fundo (opcional). Quando presente, a imagem cobre o
  // canvas inteiro (cover) e a cor/opacidade acima funcionam como um tint
  // por cima dela — útil pra manter contraste com texto sobreposto.
  imageKey?: string | null;
}

export const DEFAULT_COVER_BACKGROUND: CoverBackground = {
  color: "#ffffff",
  opacity: 1,
  imageKey: null,
};

// Fundo azul-marinho do modelo de capa/contracapa do sistema (o book padrão
// da Distribuidora). Usado ao semear padrões de CAPA e PÁGINA FINAL.
export const DEFAULT_COVER_NAVY_BACKGROUND: CoverBackground = {
  color: "#0e1b33",
  opacity: 1,
  imageKey: null,
};

const ACCENT = "#c1121f";
const INK = "#1a1a1a";
const MUTED = "#6b7280";
const ON_NAVY = "#ffffff";

let seed = 0;
function nextId(prefix: string): string {
  seed += 1;
  return `${prefix}-${Date.now()}-${seed}`;
}

// Modelo de capa padrão do sistema (fundo azul-marinho, logo da indústria à
// esquerda, logo da organização à direita, título + período + divisória +
// subtítulo centralizados). Replica o book padrão da Distribuidora. Sai
// pronto pra edição em cima quando o usuário cria um padrão de capa.
export function buildDefaultCoverLayout(): CoverElement[] {
  return [
    // Logo da indústria — canto superior esquerdo.
    {
      id: nextId("industry-logo"),
      type: "image",
      x: 48,
      y: 40,
      width: 190,
      height: 120,
      rotation: 0,
      imageKey: "",
      imageSource: "supplier",
      objectFit: "contain",
    },
    // Logo da organização — canto superior direito.
    {
      id: nextId("org-logo"),
      type: "image",
      x: 722,
      y: 48,
      width: 190,
      height: 100,
      rotation: 0,
      imageKey: "",
      imageSource: "organization",
      objectFit: "contain",
    },
    // Título do book.
    {
      id: nextId("title"),
      type: "text",
      x: 80,
      y: 236,
      width: 800,
      height: 56,
      rotation: 0,
      text: "{{nomeBook}}",
      fontSize: 40,
      color: ON_NAVY,
      fontWeight: "bold",
      align: "center",
      uppercase: true,
    },
    // Período (mês / ano).
    {
      id: nextId("period"),
      type: "text",
      x: 80,
      y: 306,
      width: 800,
      height: 30,
      rotation: 0,
      text: "{{periodo}}",
      fontSize: 20,
      color: ON_NAVY,
      fontWeight: "bold",
      align: "center",
      uppercase: true,
    },
    // Divisória.
    {
      id: nextId("divider"),
      type: "divider",
      x: 235,
      y: 400,
      width: 490,
      height: 2,
      rotation: 0,
      color: ON_NAVY,
    },
    // Subtítulo.
    {
      id: nextId("subtitle"),
      type: "text",
      x: 80,
      y: 432,
      width: 800,
      height: 60,
      rotation: 0,
      text: "TRABALHOS DE EXECUÇÃO DA EQUIPE MERCHANDISING",
      fontSize: 22,
      color: ON_NAVY,
      fontWeight: "normal",
      align: "center",
      uppercase: true,
    },
  ];
}

export function buildDefaultClosingLayout(): CoverElement[] {
  return [
    {
      id: nextId("closing-logo"),
      type: "image",
      x: 380,
      y: 200,
      width: 200,
      height: 90,
      rotation: 0,
      imageKey: "",
      imageSource: "organization",
      objectFit: "contain",
    },
    {
      id: nextId("closing-text"),
      type: "text",
      x: 80,
      y: 320,
      width: 800,
      height: 50,
      rotation: 0,
      text: "Obrigado!",
      fontSize: 30,
      color: ACCENT,
      fontWeight: "bold",
      align: "center",
      uppercase: false,
    },
  ];
}

export function createTextElement(
  overrides?: Partial<CoverTextElement>,
): CoverTextElement {
  return {
    id: nextId("text"),
    type: "text",
    x: 100,
    y: 100,
    width: 400,
    height: 40,
    rotation: 0,
    text: "Novo texto",
    fontSize: 20,
    color: INK,
    fontWeight: "normal",
    align: "left",
    uppercase: false,
    ...overrides,
  };
}

export function createImageElement(
  imageKey: string,
  overrides?: Partial<CoverImageElement>,
): CoverImageElement {
  return {
    id: nextId("image"),
    type: "image",
    x: 100,
    y: 100,
    width: 160,
    height: 90,
    rotation: 0,
    imageKey,
    objectFit: "contain",
    ...overrides,
  };
}

export function createShapeElement(
  shape: CoverShapeKind,
  overrides?: Partial<CoverShapeElement>,
): CoverShapeElement {
  return {
    id: nextId("shape"),
    type: "shape",
    shape,
    x: 120,
    y: 120,
    width: shape === "circle" ? 160 : 220,
    height: 160,
    rotation: 0,
    fill: ACCENT,
    fillOpacity: 1,
    strokeColor: INK,
    strokeWidth: 0,
    text: "",
    fontSize: 18,
    fontColor: "#ffffff",
    fontFamily: DEFAULT_FONT_FAMILY,
    fontWeight: "bold",
    ...overrides,
  };
}

export function createPhotoSlotElement(
  slotIndex: number,
  overrides?: Partial<CoverPhotoSlotElement>,
): CoverPhotoSlotElement {
  return {
    id: nextId("photo-slot"),
    type: "photoSlot",
    slotIndex,
    x: 300,
    y: 120,
    width: 320,
    height: 240,
    rotation: 0,
    objectFit: "cover",
    cornerRadius: 0,
    strokeColor: INK,
    strokeWidth: 0,
    strokeDashed: false,
    imageScale: 1,
    imageOffsetX: 50,
    imageOffsetY: 50,
    ...overrides,
  };
}

// Reproduz o layout fixo de página de PDV de book-document.tsx usando
// variáveis e slots de foto — ponto de partida do editor "Personalizado" pra
// quem quer ajustar o padrão atual em vez de montar do zero.
export function buildDefaultPageLayout(): CoverElement[] {
  const metaFields: Array<{ label: string; token: string }> = [
    { label: "Gerente", token: "{{gerente}}" },
    { label: "Coordenador(a)", token: "{{coordenador}}" },
    { label: "Consultor(a)", token: "{{consultor}}" },
    { label: "Empresa PDV", token: "{{empresaPdv}}" },
    { label: "Seção", token: "{{secao}}" },
    { label: "Código", token: "{{codigo}}" },
  ];

  const metaElements = metaFields.flatMap((field, index) => {
    const top = 80 + index * 44;
    return [
      createTextElement({
        x: 28,
        y: top,
        width: 240,
        height: 14,
        text: field.label,
        fontSize: 8,
        color: MUTED,
        fontWeight: "bold",
        uppercase: true,
      }),
      createTextElement({
        x: 28,
        y: top + 16,
        width: 240,
        height: 20,
        text: field.token,
        fontSize: 12,
        color: INK,
        fontWeight: "bold",
      }),
    ];
  });

  return [
    createShapeElement("rect", {
      x: 0,
      y: 0,
      width: 960,
      height: 56,
      fill: ACCENT,
      strokeWidth: 0,
    }),
    createTextElement({
      x: 28,
      y: 16,
      width: 600,
      height: 28,
      text: "{{loja}}",
      fontSize: 20,
      color: "#ffffff",
      fontWeight: "bold",
      uppercase: true,
    }),
    createTextElement({
      x: 660,
      y: 20,
      width: 272,
      height: 20,
      text: "{{periodo}}",
      fontSize: 11,
      color: "#ffffff",
      align: "right",
      uppercase: true,
    }),
    ...metaElements,
    createShapeElement("rounded", {
      x: 28,
      y: 356,
      width: 232,
      height: 60,
      fill: ACCENT,
      fillOpacity: 0.08,
      strokeColor: ACCENT,
      strokeWidth: 1,
    }),
    createTextElement({
      x: 42,
      y: 368,
      width: 200,
      height: 14,
      text: "Valor da ação",
      fontSize: 8,
      color: ACCENT,
      fontWeight: "bold",
      uppercase: true,
    }),
    createTextElement({
      x: 42,
      y: 384,
      width: 200,
      height: 24,
      text: "{{valorAcao}}",
      fontSize: 18,
      color: ACCENT,
      fontWeight: "bold",
    }),
    createPhotoSlotElement(0, { x: 288, y: 80, width: 316, height: 380 }),
    createPhotoSlotElement(1, { x: 616, y: 80, width: 316, height: 380 }),
    createTextElement({
      x: 700,
      y: 490,
      width: 232,
      height: 18,
      text: "{{numeroPagina}}",
      fontSize: 10,
      color: MUTED,
      align: "right",
    }),
  ];
}

// Layout default de uma página de fotos por orientação e quantidade. Traz o
// cabeçalho da indústria (logo da org à esquerda, logo da indústria à direita,
// nome do supermercado ao centro) + N espaços de foto arranjados: horizontais
// empilhados (slots largos), verticais lado a lado (slots altos). É o ponto de
// partida — a coordenadora ajusta no editor.
export function buildDefaultPhotoPageLayout(
  orientation: "LANDSCAPE" | "PORTRAIT",
  size: number,
): CoverElement[] {
  const n = Math.max(1, Math.min(size, orientation === "LANDSCAPE" ? 2 : 4));

  const header: CoverElement[] = [
    createImageElement("", {
      x: 40,
      y: 20,
      width: 150,
      height: 56,
      imageSource: "organization",
      objectFit: "contain",
    }),
    createImageElement("", {
      x: 770,
      y: 20,
      width: 150,
      height: 56,
      imageSource: "supplier",
      objectFit: "contain",
    }),
    createTextElement({
      x: 190,
      y: 32,
      width: 580,
      height: 34,
      text: "{{loja}}",
      fontSize: 24,
      color: INK,
      fontWeight: "bold",
      align: "center",
      uppercase: true,
    }),
  ];

  return [...header, ...buildPhotoSlots(orientation, n)];
}

// Só os espaços de foto arranjados por orientação e quantidade: horizontais
// empilhados (largos), verticais lado a lado (altos). Extraído pra reusar ao
// clonar o padrão base (chrome do base + estes slots).
export function buildPhotoSlots(
  orientation: "LANDSCAPE" | "PORTRAIT",
  size: number,
): CoverElement[] {
  const n = Math.max(1, Math.min(size, orientation === "LANDSCAPE" ? 2 : 4));
  const x0 = 40;
  const y0 = 100;
  const areaW = COVER_CANVAS_WIDTH - x0 * 2; // 880
  const areaH = 420;
  const gap = 12;

  const slots: CoverElement[] = [];
  if (orientation === "LANDSCAPE") {
    const h = (areaH - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      slots.push(
        createPhotoSlotElement(i, {
          x: x0,
          y: y0 + i * (h + gap),
          width: areaW,
          height: h,
        }),
      );
    }
  } else {
    const w = (areaW - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      slots.push(
        createPhotoSlotElement(i, {
          x: x0 + i * (w + gap),
          y: y0,
          width: w,
          height: areaH,
        }),
      );
    }
  }
  return slots;
}

// Clona o padrão base pra uma página de fotos (orientação, tamanho): mantém o
// chrome do base (fundo já vem separado; aqui só os elementos que NÃO são
// espaço de foto — logos, textos, formas) e insere N espaços novos.
export function buildBasePhotoLayout(
  baseLayout: unknown,
  orientation: "LANDSCAPE" | "PORTRAIT",
  size: number,
): CoverElement[] {
  const base = Array.isArray(baseLayout) ? (baseLayout as CoverElement[]) : [];
  const chrome = base.filter((el) => el.type !== "photoSlot");
  return [...chrome, ...buildPhotoSlots(orientation, size)];
}

// Reaplica o chrome do base (fundo, logos, textos — tudo que NÃO é espaço de
// foto) a um layout de página de fotos JÁ EXISTENTE, preservando os espaços de
// foto que a coordenadora posicionou naquela página. Usado pelo botão
// "Reaplicar base": atualiza o visual compartilhado sem mexer no arranjo das
// fotos.
export function reapplyBaseChrome(
  baseLayout: unknown,
  targetLayout: unknown,
): CoverElement[] {
  const base = Array.isArray(baseLayout) ? (baseLayout as CoverElement[]) : [];
  const target = Array.isArray(targetLayout)
    ? (targetLayout as CoverElement[])
    : [];
  const chrome = base.filter((el) => el.type !== "photoSlot");
  const slots = target.filter((el) => el.type === "photoSlot");
  return [...chrome, ...slots];
}

export { MUTED as COVER_MUTED_COLOR };

// "#rrggbb" + opacidade (0-1) -> "rgba(r,g,b,a)" — usado no PDF (react-pdf
// não tem prop `opacity` separada pra View de fundo cobrindo a página).
export function coverBackgroundToRgba(background: CoverBackground): string {
  const hex = background.color.replace("#", "");
  const bigint = Number.parseInt(
    hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex,
    16,
  );
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${background.opacity})`;
}
