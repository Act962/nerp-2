import type { SiteBlock } from "./blocks";
import { findCatalogTool } from "./catalog";
import type { SitePageSeed } from "./pages";

/**
 * Os segmentos atendidos e as páginas deles.
 *
 * **O que aqui é fato e o que é curadoria.** O nome e a frase de cada segmento
 * vieram do material da marca. A cor também. O que é escolha editorial minha é
 * a LISTA de ferramentas de cada segmento — quais da suíte pesam mais naquela
 * operação — e ela está aqui, num lugar só, para ser revista e trocada; no
 * admin, item por item.
 *
 * O que NÃO existe aqui é frase do tipo "o CRM aumenta as vendas do
 * supermercado em X". O texto de cada ferramenta é o do catálogo, o mesmo do
 * resto do site: o que ela é, sem promessa costurada para o segmento. Escrever
 * essa promessa é trabalho de quem conhece o cliente, e o bloco está pronto e
 * vazio no admin esperando por ela.
 */

export type Segment = {
  id: string;
  name: string;
  summary: string;
  color: string;
  /** As ferramentas que abrem a página do segmento, nesta ordem. */
  tools: string[];
};

export const SEGMENTS: Segment[] = [
  {
    id: "supermercados",
    name: "Supermercados",
    summary: "Loja cheia, margem apertada e giro que não espera.",
    color: "#2f9bf5",
    tools: [
      "pdv",
      "estoque",
      "inventario",
      "catalogo-promocional",
      "catalogo-online",
      "qr-preco",
      "planograma",
      "tradegram",
      "book",
    ],
  },
  {
    id: "clinicas",
    name: "Clínicas",
    summary: "Agenda, prontuário do processo e retorno do paciente.",
    color: "#22a06b",
    tools: ["agendas", "chat", "tracking", "forms", "payment", "trafego"],
  },
  {
    id: "atacarejos",
    name: "Atacarejos",
    summary: "Atacado e varejo no mesmo CNPJ, com preço por canal.",
    color: "#8b3fe8",
    tools: [
      "pdv",
      "estoque",
      "catalogo-promocional",
      "catalogo-online",
      "tracking",
      "forge",
      "payment",
    ],
  },
  {
    id: "franquias",
    name: "Franquias",
    summary: "Rede inteira no mesmo padrão, cada unidade no seu ritmo.",
    color: "#f2792b",
    tools: [
      "ranking",
      "workspaces",
      "route",
      "space-station",
      "planograma",
      "book",
      "trafego",
    ],
  },
  {
    id: "food",
    name: "Food Service",
    summary: "Salão, delivery e cozinha puxando do mesmo estoque.",
    color: "#ee3b32",
    tools: [
      "pdv",
      "catalogo-online",
      "chat",
      "agendas",
      "linnker",
      "comments",
      "trafego",
    ],
  },
  {
    id: "automotivo",
    name: "Centro automotivo",
    summary: "Orçamento, ordem de serviço e peça na bancada.",
    color: "#0f9b9b",
    tools: ["tracking", "forge", "agendas", "chat", "estoque", "trafego"],
  },
];

export function buildSegmentPage(
  segment: Segment,
  options: { whatsappHref: string },
): SitePageSeed {
  const tools = segment.tools
    .map((id) => findCatalogTool(id))
    .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool));

  const blocks: SiteBlock[] = [
    {
      id: "hero",
      type: "hero",
      enabled: true,
      eyebrow: "Segmentos",
      title: segment.name,
      text: segment.summary,
      primary: {
        label: "Agendar uma demonstração",
        href: options.whatsappHref,
      },
      secondary: { label: "Ver a suíte", href: "#funcionalidades" },
      image: { key: "", alt: "" },
    },
    {
      id: "statement",
      type: "statement",
      enabled: true,
      title: "A mesma suíte, na ordem que essa operação usa.",
      text: "As ferramentas escrevem no mesmo cadastro e no mesmo histórico — o que uma registra, a outra já enxerga.",
      cta: { label: "Falar com um especialista", href: options.whatsappHref },
    },
    {
      id: "features",
      type: "features",
      enabled: true,
      title: `A suíte em ${segment.name.toLowerCase()}`,
      // O texto de cada uma é o do catálogo: o que ela é, sem promessa
      // costurada para o segmento.
      items: tools.map((tool) => ({
        title: tool.name,
        text: tool.tagline,
      })),
    },
    {
      id: "compare",
      type: "compare",
      // Desligado: as duas colunas seriam invenção sobre a operação do cliente.
      enabled: false,
      title: `Com a ÓRBITA em ${segment.name.toLowerCase()}`,
      moreTitle: "MAIS",
      more: [],
      lessTitle: "MENOS",
      less: [],
    },
    {
      id: "split",
      type: "split",
      enabled: false,
      title: "",
      paragraphs: [],
      image: { key: "", alt: "" },
      imageSide: "left",
    },
    {
      id: "clients",
      type: "clients",
      // Faixa de clientes deste segmento: entra quando houver logo de verdade.
      enabled: false,
      title: "Quem já opera assim",
      logos: [],
    },
    {
      id: "contact",
      type: "contact",
      enabled: true,
      title: "Vamos olhar a sua operação?",
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
    section: "segmentos",
    slug: segment.id,
    title: segment.name,
    seoTitle: `${segment.name} — ÓRBITA HUB`,
    seoDescription: segment.summary,
    blocks,
  };
}

export function buildAllSegmentPages(options: {
  whatsappHref: string;
}): SitePageSeed[] {
  return SEGMENTS.map((segment) => buildSegmentPage(segment, options));
}
