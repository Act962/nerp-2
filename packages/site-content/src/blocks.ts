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

const blockBase = { id: z.string(), enabled: z.boolean().default(true) };

export const heroBlock = z.object({
  ...blockBase,
  type: z.literal("hero"),
  eyebrow: z.string().default(""),
  title: z.string().default(""),
  text: z.string().default(""),
  primary: linkRef.default({ label: "", href: "" }),
  secondary: linkRef.default({ label: "", href: "" }),
  image: imageRef.default({ key: "", alt: "" }),
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
    case "video":
      return videoBlock.parse(base);
    case "clients":
      return clientsBlock.parse(base);
    case "contact":
      return contactBlock.parse(base);
  }
}

/** `youtu.be/x`, `watch?v=x` ou `embed/x` → o id, ou null. */
export function youtubeId(url: string): string | null {
  if (!url) return null;
  const m = /(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{6,})/.exec(
    url,
  );
  return m ? m[1] : null;
}
