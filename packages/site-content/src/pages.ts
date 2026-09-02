import type { SiteBlock } from "./blocks";
import { CATEGORIES, findCatalogTool, RAW_TOOLS, type Tool } from "./catalog";

/**
 * A página interna de uma solução, montada a partir do catálogo.
 *
 * Existe para as 19 soluções nascerem com a mesma estrutura sem ninguém
 * escrever 19 páginas à mão — e para os dois apps concordarem sobre o que é
 * essa estrutura: o `apps/site` usa como conteúdo de reserva e o `apps/web`
 * usa para semear o banco, de onde o admin passa a editar.
 *
 * **A regra que decide o que entra ligado.** Bloco que o catálogo consegue
 * preencher com texto real nasce LIGADO; bloco que só existiria com texto de
 * venda inventado nasce DESLIGADO, com os campos prontos e vazios. O catálogo
 * diz o que cada ferramenta é e o que ela faz — não diz qual dor ela cura nem
 * quem são os clientes. Inventar isso seria colocar promessa no ar em nome da
 * empresa; deixar desligado põe o bloco na mão de quem sabe, no admin.
 *
 * Por isso `hero`, `statement`, `features` e `contact` vêm prontos, e
 * `compare`, `split`, `video` e `clients` vêm desligados — a não ser que a
 * ferramenta tenha um texto próprio em `PAGE_COPY`, escrito e aprovado.
 */

/** O trecho do site em que a página vive — o primeiro pedaço da URL. */
export type SiteSection = "solucoes" | "segmentos" | "sobre";

export type SitePageSeed = {
  section: SiteSection;
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  blocks: SiteBlock[];
  /** Só nas páginas de solução: liga a página à ferramenta do catálogo. */
  toolId?: string;
};

/** Mantido para quem já importava o nome antigo. */
export type SolutionPage = SitePageSeed;

/** Texto aprovado, por ferramenta. O que não estiver aqui fica desligado. */
type PageCopy = {
  /** Endereço da página. Sem isto, o slug sai do id da ferramenta. */
  slug?: string;
  heroTitle?: string;
  statementTitle?: string;
  statementText?: string;
  compare?: { more: string[]; less: string[] };
  split?: { title: string; paragraphs: string[] };
};

const PAGE_COPY: Record<string, PageCopy> = {
  tracking: {
    slug: "crm-tracking",
    heroTitle: "CRM Tracking: o funil que anda quando o card anda",
    statementTitle:
      "Um CRM que se adapta ao processo que a sua empresa já tem.",
    statementText:
      "Vários funis sobre a mesma base de contatos, com as etapas que o seu time usa todo dia.",
    compare: {
      more: [
        "Todo o histórico do contato num lugar só",
        "Previsibilidade do que vai fechar",
        "Motivo registrado em cada perda",
        "O time inteiro olhando o mesmo funil",
      ],
      less: [
        "Lead esquecido na caixa de entrada",
        "Planilha paralela que só uma pessoa entende",
        "Reunião para descobrir em que pé está cada negócio",
        "Card parado sem ninguém perceber",
      ],
    },
    split: {
      title: "O funil no bolso de quem está na rua",
      paragraphs: [
        "O vendedor move o card, registra o motivo e vê o histórico do contato sem voltar para o computador.",
      ],
    },
  },
};

/** `space-station` já vem com hífen; o resto é o próprio id. */
function slugFor(tool: Tool) {
  return PAGE_COPY[tool.id]?.slug ?? tool.id;
}

export function buildSolutionPage(
  tool: Tool,
  options: { whatsappHref: string },
): SitePageSeed {
  const copy = PAGE_COPY[tool.id] ?? {};
  const category = CATEGORIES.find((c) => c.id === tool.category);

  const blocks: SiteBlock[] = [
    {
      id: "hero",
      type: "hero",
      enabled: true,
      eyebrow: category?.title ?? "",
      title: copy.heroTitle ?? `${tool.fullName}: ${tool.tagline}`,
      text: tool.summary,
      primary: {
        label: "Agendar uma demonstração",
        href: options.whatsappHref,
      },
      secondary: { label: "Ver funcionalidades", href: "#funcionalidades" },
      image: { key: "", alt: "" },
    },
    {
      id: "statement",
      type: "statement",
      enabled: true,
      title: copy.statementTitle ?? tool.tagline,
      text: copy.statementText ?? tool.summary,
      cta: { label: "Falar com um especialista", href: options.whatsappHref },
    },
    {
      id: "compare",
      type: "compare",
      // Sem texto aprovado, as duas colunas seriam invenção.
      enabled: Boolean(copy.compare),
      title: `Com o ${tool.name} você terá`,
      moreTitle: "MAIS",
      more: copy.compare?.more ?? [],
      lessTitle: "MENOS",
      less: copy.compare?.less ?? [],
    },
    {
      id: "features",
      type: "features",
      // Sem funcionalidades no catálogo, o bloco entra desligado em vez de
      // aparecer vazio na página.
      enabled: tool.features.length > 0,
      title: `O que o ${tool.name} faz`,
      items: tool.features.map((feature) => ({
        title: feature.title,
        text: feature.description,
      })),
    },
    {
      id: "split",
      type: "split",
      enabled: Boolean(copy.split),
      title: copy.split?.title ?? "",
      paragraphs: copy.split?.paragraphs ?? [],
      image: { key: "", alt: "" },
      imageSide: "left",
    },
    {
      id: "video",
      type: "video",
      // Ligado sem endereço, o painel azul apareceria vazio.
      enabled: false,
      title: "Mais que um sistema, uma parceria",
      text: "",
      youtubeUrl: "",
    },
    {
      id: "clients",
      type: "clients",
      // Faixa de clientes sem logo é promessa vazia.
      enabled: false,
      title: "Nossos clientes",
      logos: [],
    },
    {
      id: "contact",
      type: "contact",
      enabled: true,
      title: "Vamos impulsionar a gestão do seu negócio?",
      options: [
        {
          kind: "whatsapp",
          label: "Converse por WhatsApp",
          href: options.whatsappHref,
        },
        {
          kind: "callback",
          label: "Nós ligamos para você",
          href: options.whatsappHref,
        },
      ],
    },
  ];

  return {
    section: "solucoes",
    slug: slugFor(tool),
    toolId: tool.id,
    title: tool.name,
    seoTitle: `${tool.name} — ÓRBITA HUB`,
    seoDescription: tool.tagline,
    blocks,
  };
}

/** As 19 páginas de solução, na ordem do catálogo. */
export function buildAllSolutionPages(options: {
  whatsappHref: string;
}): SitePageSeed[] {
  return RAW_TOOLS.map((tool) => buildSolutionPage(tool, options));
}

/** O slug de uma ferramenta, para o menu apontar para a página dela. */
export function solutionSlug(toolId: string): string | null {
  const tool = findCatalogTool(toolId);
  return tool ? slugFor(tool) : null;
}
