import { z } from "zod";

/**
 * Os blocos de uma página interna do site.
 *
 * A página é uma lista de blocos, não um punhado de colunas: no admin ela é
 * montada arrastando, ligando e desligando. O banco guarda JSON; a garantia do
 * formato é este arquivo — tudo que sai do banco passa por `parseBlocks` antes
 * de virar props, então um JSON antigo ou torto nunca chega no componente.
 *
 * Regra ao evoluir: campo novo entra OPCIONAL ou com `.default()`. Um campo
 * obrigatório novo invalida todas as páginas já salvas de uma vez.
 */

const imageRef = z.object({
  /** Key do objeto no R2 (ou caminho de asset que já vem com o app). */
  key: z.string().default(""),
  alt: z.string().default(""),
});

const linkRef = z.object({
  label: z.string().default(""),
  href: z.string().default(""),
});

/**
 * Fundo da faixa que o bloco ocupa.
 *
 * `auto` é o padrão e é o que faz a página respirar sozinha: as faixas visíveis
 * ALTERNAM entre `base` e `contraste`, na ordem em que aparecem. Assim, mexer na
 * ordem dos blocos ou desligar um deles não deixa duas faixas iguais coladas —
 * o que aconteceria se cada bloco guardasse uma cor fixa.
 *
 * Os outros valores são a escapatória para quando a alternância não serve: uma
 * faixa que precisa saltar no meio da página.
 */
export const blockBackground = z
  .enum(["auto", "base", "contraste", "destaque", "claro"])
  .optional();

/**
 * OPCIONAL, e não `.default("auto")`, por dois motivos que se somam: as páginas
 * já salvas não têm o campo, e os catálogos em código montam bloco por literal
 * — com `default` o TypeScript passaria a exigir a cor em cada um dos ~30
 * blocos semeados, sem nenhum ganho. Ausente significa `auto`.
 */
export type BlockBackground = NonNullable<z.infer<typeof blockBackground>>;

/** Só as cores de verdade — `auto` é resolvido antes de virar classe. */
export type ResolvedBackground = Exclude<BlockBackground, "auto">;

/**
 * Aparência de um bloco.
 *
 * TUDO opcional, e é isso que torna a coisa segura: bloco sem `style` — ou seja,
 * todos os que já estão salvos — desenha exatamente como desenhava. Cada campo
 * preenchido vira uma variável CSS no envoltório do bloco, e o CSS da página
 * consome com `var(--x, <padrão de sempre>)`. Ninguém precisa reescrever o CSS
 * de um bloco para ele passar a aceitar cor: o padrão continua no lugar.
 *
 * Por SLOT (título, texto, itens), e não por item individual da lista: cor de
 * cada linha viraria um painel que ninguém consegue operar, e a página perderia
 * a unidade que faz ela parecer um site e não um mural.
 */
const textStyle = z
  .object({
    /** `#rrggbb`. Vazio herda a cor de sempre. */
    color: z.string().optional(),
    /** Em `rem`, para acompanhar o zoom do navegador. */
    size: z.number().min(0.6).max(6).optional(),
    family: z.enum(["padrao", "titulo", "mono"]).optional(),
    weight: z.enum(["300", "400", "500", "600", "700", "800"]).optional(),
  })
  .optional();

const buttonStyle = z
  .object({
    background: z.string().optional(),
    /** Segunda cor do degradê. Vazia = cor chapada. */
    backgroundTo: z.string().optional(),
    color: z.string().optional(),
  })
  .optional();

/**
 * O efeito de chamar atenção. Desligado por padrão — animação que ninguém pediu
 * é ruído, e numa página inteira delas o destaque deixa de destacar.
 */
const effectStyle = z
  .object({
    enabled: z.boolean().default(false),
    kind: z.enum(["pulso", "brilho", "flutuar"]).default("pulso"),
    /** 0 = quase parado, 100 = bem marcado. */
    intensity: z.number().min(0).max(100).default(50),
  })
  .optional();

/**
 * Flutuação da imagem.
 *
 * `smoothness` controla a DURAÇÃO do ciclo, não a distância: subir mais rápido
 * é o que faz o movimento parecer nervoso, e é esse o botão que a pessoa quer
 * quando diz "suaviza". A sombra fica na base porque é ela que sustenta a
 * ilusão — objeto que flutua sem sombra parece colado, não suspenso.
 */
const imageStyle = z
  .object({
    float: z.boolean().default(false),
    /** 0 = rápido e nervoso, 100 = lento e suave. */
    smoothness: z.number().min(0).max(100).default(60),
    shadow: z.boolean().default(true),
    shadowStrength: z.number().min(0).max(100).default(45),
  })
  .optional();

export const blockStyle = z
  .object({
    /** Conta-gotas: sobrepõe a faixa semântica quando preenchido. */
    background: z.string().optional(),
    /** Segunda cor do fundo, para degradê. */
    backgroundTo: z.string().optional(),
    title: textStyle,
    text: textStyle,
    items: textStyle,
    button: buttonStyle,
    effect: effectStyle,
    image: imageStyle,
  })
  .optional();

export type BlockStyle = NonNullable<z.infer<typeof blockStyle>>;
export type TextSlot = "title" | "text" | "items";

const blockBase = {
  id: z.string(),
  enabled: z.boolean().default(true),
  background: blockBackground,
  style: blockStyle,
};

export const heroBlock = z.object({
  ...blockBase,
  type: z.literal("hero"),
  eyebrow: z.string().default(""),
  title: z.string().default(""),
  text: z.string().default(""),
  primary: linkRef.default({ label: "", href: "" }),
  secondary: linkRef.default({ label: "", href: "" }),
  image: imageRef.default({ key: "", alt: "" }),
  /**
   * A "caixa" do herói: descola a arte das bordas da faixa e desenha uma
   * moldura arredondada em volta. Sem `frame`, o herói desenha como sempre —
   * cola nas bordas, sem borda visível.
   *
   * `inset` é a margem externa em `px` (mesmo valor nos quatro lados —
   * quem precisar de laterais diferentes cai no editor manual do CSS, que é
   * outra história).
   *
   * `radius` traz os quatro cantos separados; qualquer campo omitido vira 0.
   * `border` traz a espessura em `px` e a cor da moldura.
   */
  frame: z
    .object({
      inset: z.number().min(0).max(200).default(0),
      radius: z
        .object({
          topLeft: z.number().min(0).max(200).default(0),
          topRight: z.number().min(0).max(200).default(0),
          bottomRight: z.number().min(0).max(200).default(0),
          bottomLeft: z.number().min(0).max(200).default(0),
        })
        .default({ topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 }),
      border: z
        .object({
          width: z.number().min(0).max(20).default(0),
          color: z.string().default("#000000"),
        })
        .default({ width: 0, color: "#000000" }),
    })
    .optional(),
});

export const statementBlock = z.object({
  ...blockBase,
  type: z.literal("statement"),
  title: z.string().default(""),
  text: z.string().default(""),
  cta: linkRef.default({ label: "", href: "" }),
});

export const compareBlock = z.object({
  ...blockBase,
  type: z.literal("compare"),
  title: z.string().default(""),
  moreTitle: z.string().default("MAIS"),
  more: z.array(z.string()).default([]),
  lessTitle: z.string().default("MENOS"),
  less: z.array(z.string()).default([]),
});

export const featuresBlock = z.object({
  ...blockBase,
  type: z.literal("features"),
  title: z.string().default(""),
  items: z
    .array(z.object({ title: z.string(), text: z.string().default("") }))
    .default([]),
});

export const splitBlock = z.object({
  ...blockBase,
  type: z.literal("split"),
  title: z.string().default(""),
  paragraphs: z.array(z.string()).default([]),
  image: imageRef.default({ key: "", alt: "" }),
  imageSide: z.enum(["left", "right"]).default("left"),
});

export const videoBlock = z.object({
  ...blockBase,
  type: z.literal("video"),
  title: z.string().default(""),
  text: z.string().default(""),
  /** Endereço do YouTube. Vazio = a seção não aparece. */
  youtubeUrl: z.string().default(""),
  /**
   * `painel` é o bloco azul com o vídeo embaixo do texto — o de sempre.
   * `lado` põe o player de um lado e o texto do outro, e ABRE MÃO do painel
   * azul: nesse arranjo o fundo é o da faixa (ver `blockBackground`), que é o
   * que deixa a seção clara sem inventar uma segunda cor aqui dentro.
   *
   * Opcional pelo mesmo motivo do fundo: ausente vale `painel`, e os catálogos
   * em código seguem montando o bloco sem precisar declarar o arranjo.
   */
  layout: z.enum(["painel", "lado"]).optional(),
  /** Só no `lado`: de que lado fica o player. Ausente vale `left`. */
  videoSide: z.enum(["left", "right"]).optional(),
  /** Só no `lado`: proporção do player. Ausente vale 16/9. */
  aspect: z.enum(["16/9", "4/3", "1/1"]).optional(),
});

export const clientsBlock = z.object({
  ...blockBase,
  type: z.literal("clients"),
  title: z.string().default("Nossos clientes"),
  logos: z.array(imageRef).default([]),
});

/**
 * Um passo a passo — o Método N.A.S.A. é quem pediu este bloco.
 *
 * Cada etapa tem uma marca curta (a letra), um nome, a pergunta que ela
 * responde e o texto. As perguntas ficam separadas do corpo de propósito: são
 * elas que a pessoa leva embora, e num parágrafo corrido se perderiam.
 */
export const stepsBlock = z.object({
  ...blockBase,
  type: z.literal("steps"),
  title: z.string().default(""),
  text: z.string().default(""),
  /**
   * Desenha as etapas em círculo antes da lista, com a última voltando para a
   * segunda. Só faz sentido quando o passo a passo é um CICLO — se ele termina,
   * o desenho mentiria.
   */
  cycle: z.boolean().default(false),
  items: z
    .array(
      z.object({
        /** "N", "1", "01" — o que marca a etapa. */
        mark: z.string().default(""),
        title: z.string(),
        question: z.string().default(""),
        text: z.string().default(""),
        bullets: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

/**
 * Título e imagem de um lado, uma lista conferida do outro.
 *
 * A lista é de STRINGS, não de {título, texto}: cada linha aqui é uma
 * afirmação curta que a pessoa varre com o olho. Dar um corpo a cada item
 * convidaria a escrever parágrafo, e o bloco perderia exatamente o que ele
 * faz bem — caber inteiro numa tela.
 */
export const checklistBlock = z.object({
  ...blockBase,
  type: z.literal("checklist"),
  title: z.string().default(""),
  /** Fecho do título, em negrito. Vazio = título de peso único. */
  titleStrong: z.string().default(""),
  image: imageRef.default({ key: "", alt: "" }),
  /** Chamada ao lado da imagem. Sem `href`, sai como texto e não como link. */
  cta: linkRef.default({ label: "", href: "" }),
  items: z.array(z.string()).default([]),
});

/**
 * Os cartões de vantagem, em duas colunas.
 *
 * Difere do `features` em duas coisas que mudam o uso: cada cartão tem ÍCONE
 * próprio, e o texto é um parágrafo, não uma frase. É o bloco de "por que
 * isso importa", enquanto `features` é o de "o que tem dentro".
 */
export const benefitsBlock = z.object({
  ...blockBase,
  type: z.literal("benefits"),
  title: z.string().default(""),
  items: z
    .array(
      z.object({
        icon: imageRef.default({ key: "", alt: "" }),
        title: z.string(),
        text: z.string().default(""),
      }),
    )
    .default([]),
});

/**
 * Uma imagem numa faixa própria.
 *
 * Existia dentro de outros blocos (herói, split, checklist), mas nunca solta —
 * este bloco é a saída para "quero botar um print aqui, sem títulos e sem
 * texto acompanhando". Todo controle visual (recorte, cantos, contorno,
 * dimensão) fica no PRÓPRIO bloco em vez do painel de aparência: são decisões
 * inerentes à imagem, não estilo genérico do bloco.
 */
export const imageBlock = z.object({
  ...blockBase,
  type: z.literal("image"),
  image: imageRef.default({ key: "", alt: "" }),
  /**
   * Como a imagem preenche a caixa.
   *
   * `contain` mostra a imagem inteira e deixa sobra dos lados; `cover` recorta
   * o que sobra para preencher tudo. Sem escolha, `contain` — respeita a arte
   * original.
   */
  fit: z.enum(["contain", "cover"]).optional(),
  /**
   * Alinhamento horizontal. Cabível principalmente quando a imagem é mais
   * estreita que a caixa (padrão) ou quando ela sofreu `cover` e escolhe qual
   * borda preservar.
   */
  align: z.enum(["left", "center", "right"]).optional(),
  /**
   * Cantos arredondados em `px`. 0 = quadrado, ~9999 = pílula/círculo — como
   * `border-radius` do CSS já resolve o extremo, evito uma cor "circular"
   * separada.
   */
  radius: z.number().min(0).max(9999).optional(),
  border: z
    .object({
      /** Espessura em `px`; 0 = sem contorno. */
      width: z.number().min(0).max(20).default(0),
      /** `#rrggbb`. */
      color: z.string().default("#000000"),
    })
    .optional(),
  /**
   * Dimensões da caixa da imagem. Números em `px`, ausente = automático (a
   * imagem manda; largura vira 100% da coluna). Máximo largo para o admin não
   * conseguir criar uma faixa que estoure o desenho da página inteira.
   */
  width: z.number().min(50).max(2400).optional(),
  height: z.number().min(50).max(2400).optional(),
  /**
   * Envolve a imagem num aparelho como se ela estivesse aparecendo NA TELA
   * dele. `nenhum` desliga.
   *
   * Bloco Imagem NOVO nasce com `iphone` — o pedido é "toda vez que alguém
   * subir um print, ele aparece no aparelho". Bloco já salvo sem esse valor
   * (das páginas antigas) cai no `default` do zod ao ser lido e passa a mostrar
   * o aparelho também — se for indesejado num caso específico, é uma escolha
   * "nenhum" no editor.
   */
  mockup: z.enum(["nenhum", "iphone"]).default("iphone"),
});

export const contactBlock = z.object({
  ...blockBase,
  type: z.literal("contact"),
  title: z.string().default(""),
  options: z
    .array(
      z.object({
        kind: z.enum(["phone", "whatsapp", "callback"]),
        label: z.string(),
        href: z.string().default(""),
      }),
    )
    .default([]),
});

export const siteBlock = z.discriminatedUnion("type", [
  heroBlock,
  statementBlock,
  compareBlock,
  featuresBlock,
  splitBlock,
  stepsBlock,
  checklistBlock,
  benefitsBlock,
  imageBlock,
  videoBlock,
  clientsBlock,
  contactBlock,
]);

export type SiteBlock = z.infer<typeof siteBlock>;
export type SiteBlockType = SiteBlock["type"];

export const siteBlocks = z.array(siteBlock);

/** Nome de cada bloco na tela do admin. */
export const BLOCK_LABELS: Record<SiteBlockType, string> = {
  hero: "Herói",
  statement: "Declaração",
  compare: "Mais / Menos",
  features: "Funcionalidades",
  split: "Aplicativo",
  steps: "Etapas",
  checklist: "Recursos",
  benefits: "Vantagens",
  image: "Imagem",
  video: "Vídeo",
  clients: "Clientes",
  contact: "Contato",
};

export const BLOCK_HINTS: Record<SiteBlockType, string> = {
  hero: "Título, subtítulo, botões e a imagem grande",
  statement: "A frase escura com o botão no meio",
  compare: "Os dois cartões de comparação",
  features: "Os cards de funcionalidade",
  split: "Bloco dividido: texto de um lado, imagem do outro",
  steps: "Um passo a passo, com marca, pergunta e texto",
  checklist: "Título e imagem de um lado, lista conferida do outro",
  benefits: "Cartões com ícone, título e parágrafo, em duas colunas",
  image: "Uma imagem sozinha, com recorte, contorno e dimensão próprios",
  video: "Painel azul com o vídeo do YouTube",
  clients: "Faixa branca com as logos",
  contact: "As formas de falar com o time",
};

/**
 * Lê o JSON do banco com tolerância: bloco que não bate com o formato é
 * DESCARTADO em vez de derrubar a página inteira. Uma página com um bloco a
 * menos ainda é uma página; um `throw` aqui seria um 500 no site público.
 */
export function parseBlocks(value: unknown): SiteBlock[] {
  if (!Array.isArray(value)) return [];
  const out: SiteBlock[] = [];
  for (const item of value) {
    const parsed = siteBlock.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/** Um bloco novo, já com os campos que a tela espera. */
export function emptyBlock(type: SiteBlockType, id: string): SiteBlock {
  const base = { id, enabled: true, type } as const;
  switch (type) {
    case "hero":
      return heroBlock.parse(base);
    case "statement":
      return statementBlock.parse(base);
    case "compare":
      return compareBlock.parse(base);
    case "features":
      return featuresBlock.parse(base);
    case "split":
      return splitBlock.parse(base);
    case "steps":
      return stepsBlock.parse(base);
    case "checklist":
      return checklistBlock.parse(base);
    case "benefits":
      return benefitsBlock.parse(base);
    case "image":
      return imageBlock.parse(base);
    case "video":
      return videoBlock.parse(base);
    case "clients":
      return clientsBlock.parse(base);
    case "contact":
      return contactBlock.parse(base);
  }
}

/**
 * Resolve o `auto` de cada bloco em cor de verdade.
 *
 * A alternância conta só os blocos VISÍVEIS: um bloco desligado não pode
 * consumir uma vez do rodízio, senão desligá-lo faria duas faixas iguais se
 * encostarem. E a cor escolhida à mão não entra na conta — ela é uma exceção
 * deliberada, não um passo da sequência.
 */
export function resolveBackgrounds(
  blocks: Pick<SiteBlock, "background" | "enabled">[],
): ResolvedBackground[] {
  let alternadas = 0;
  return blocks.map((block) => {
    const escolhido = block.background ?? "auto";
    if (escolhido !== "auto") return escolhido;
    if (!block.enabled) return "base";
    const cor: ResolvedBackground = alternadas % 2 === 0 ? "base" : "contraste";
    alternadas++;
    return cor;
  });
}

/** Nome de cada arranjo do bloco de vídeo, na tela do admin. */
export const VIDEO_LAYOUT_LABELS = {
  painel: "Painel azul (vídeo embaixo do texto)",
  lado: "Lado a lado (vídeo e texto)",
} as const;

export const VIDEO_SIDE_LABELS = {
  left: "Vídeo à esquerda",
  right: "Vídeo à direita",
} as const;

export const VIDEO_ASPECT_LABELS = {
  "16/9": "16:9 (padrão do YouTube)",
  "4/3": "4:3",
  "1/1": "Quadrado",
} as const;

/** Nome de cada fundo na tela do admin. */
export const BACKGROUND_LABELS: Record<BlockBackground, string> = {
  auto: "Automático (alterna)",
  base: "Base",
  contraste: "Contraste",
  destaque: "Destaque",
  claro: "Claro",
};

/** `youtu.be/x`, `watch?v=x` ou `embed/x` → o id, ou null. */
export function youtubeId(url: string): string | null {
  if (!url) return null;
  const m = /(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{6,})/.exec(
    url,
  );
  return m ? m[1] : null;
}
