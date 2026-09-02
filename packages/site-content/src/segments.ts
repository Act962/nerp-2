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
 * resto do site: o que ela é, sem promessa costurada para o segmento.
 *
 * Em 2026-09-02 as seis páginas ganharam `compare` e `split` para ir ao ar,
 * pela mesma regra de `pages.ts`: MAIS é funcionalidade que existe nas
 * ferramentas listadas, MENOS é a ausência literal dela. Promessa de resultado
 * continua fora.
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

/**
 * O texto aprovado de cada segmento.
 *
 * Mesma regra das páginas de solução (`pages.ts`): cada linha de MAIS é uma
 * funcionalidade que existe nas ferramentas listadas acima, e cada linha de
 * MENOS é a ausência literal dela — o trabalho manual que ela substitui. Não
 * há promessa de resultado aqui, e não deve haver.
 */
const SEGMENT_COPY: Record<
  string,
  {
    compare: { more: string[]; less: string[] };
    split: { title: string; paragraphs: string[] };
  }
> = {
  supermercados: {
    compare: {
      more: [
        "Caixa, estoque e encarte na mesma base",
        "Preço por loja, corrigido de uma vez",
        "Inventário pelo celular do próprio time",
        "A execução da gôndola registrada em foto",
      ],
      less: [
        "Encarte no designer toda semana",
        "Contagem que fecha a loja",
        "Preço divergente entre a gôndola e o caixa",
        "Execução conferida por amostragem",
      ],
    },
    split: {
      title: "Do encarte à gôndola, sobre o mesmo cadastro",
      paragraphs: [
        "O produto que o PDV vende é o mesmo do encarte, do catálogo online e do planograma — trocar um preço vale para todos de uma vez.",
      ],
    },
  },
  clinicas: {
    compare: {
      more: [
        "Página pública para o paciente marcar",
        "A conversa junto do histórico",
        "Cobrança e recibo no mesmo lugar",
        "O anúncio ligado ao agendamento",
      ],
      less: [
        "Vai-e-volta de mensagem para achar horário",
        "Ficha que só existe no papel",
        "Recebimento controlado em planilha",
        "Anúncio que gera contato e some",
      ],
    },
    split: {
      title: "Da primeira mensagem ao retorno",
      paragraphs: [
        "O contato chega pelo anúncio ou pelo formulário, conversa pelo chat, marca na página pública e é cobrado pelo mesmo sistema — sem trocar de cadastro.",
      ],
    },
  },
  atacarejos: {
    compare: {
      more: [
        "Preço por canal sobre o mesmo cadastro",
        "Proposta pronta para o cliente de atacado",
        "Vitrine e balcão no mesmo estoque",
        "Financeiro ligado à venda",
      ],
      less: [
        "Uma tabela de preço em planilha por canal",
        "Proposta refeita a cada pedido",
        "Estoque dividido em dois sistemas",
        "Cobrança fora do sistema que vendeu",
      ],
    },
    split: {
      title: "Dois canais, um cadastro",
      paragraphs: [
        "Atacado e varejo no mesmo CNPJ pedem preço por canal — e não dois sistemas. O produto, o estoque e o cliente são os mesmos dos dois lados.",
      ],
    },
  },
  franquias: {
    compare: {
      more: [
        "Meta por unidade, com pódio",
        "O padrão da rede escrito e treinado",
        "A gôndola comparada em toda unidade",
        "O time inteiro no mesmo escritório",
      ],
      less: [
        "Uma planilha de meta em cada franqueado",
        "Treinamento repetido unidade por unidade",
        "Padrão que só existe no manual",
        "Reunião de rede para cada aviso",
      ],
    },
    split: {
      title: "A rede no mesmo padrão, sem tirar o ritmo de cada uma",
      paragraphs: [
        "Metas e pódio por unidade, trilhas de treinamento no Route, planograma e book para conferir a execução, e o Space Station para o time se encontrar.",
      ],
    },
  },
  food: {
    compare: {
      more: [
        "Cardápio no endereço da própria casa",
        "Pedido que entra pela conversa",
        "Reserva marcada pelo cliente",
        "O link da bio devolvendo contato",
      ],
      less: [
        "Cardápio em PDF que desatualiza",
        "Pedido anotado no papel",
        "Reserva combinada por telefone",
        "Comentário no Instagram sem resposta",
      ],
    },
    split: {
      title: "Salão, delivery e cozinha puxando do mesmo estoque",
      paragraphs: [
        "O catálogo online é a mesma base do PDV, o pedido chega pelo chat e a reserva pela agenda — e o que sai reduz o estoque uma vez só.",
      ],
    },
  },
  automotivo: {
    compare: {
      more: [
        "Orçamento que vira ordem de serviço",
        "A peça com saldo à vista na hora do orçamento",
        "O horário do serviço marcado pelo cliente",
        "A conversa junto do histórico do veículo",
      ],
      less: [
        "Orçamento em bloco de papel",
        "Peça prometida que não estava em estoque",
        "Agenda da oficina no caderno",
        "Retorno do cliente sem histórico nenhum",
      ],
    },
    split: {
      title: "Do orçamento à bancada",
      paragraphs: [
        "O orçamento sai do Forge sobre o estoque real de peças, vira etapa no funil e horário na agenda — com a conversa toda no mesmo contato.",
      ],
    },
  },
};

export function buildSegmentPage(
  segment: Segment,
  options: { whatsappHref: string },
): SitePageSeed {
  const copy = SEGMENT_COPY[segment.id];
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
      enabled: Boolean(copy),
      title: `Com a ÓRBITA em ${segment.name.toLowerCase()}`,
      moreTitle: "MAIS",
      more: copy?.compare.more ?? [],
      lessTitle: "MENOS",
      less: copy?.compare.less ?? [],
    },
    {
      id: "split",
      type: "split",
      enabled: Boolean(copy),
      title: copy?.split.title ?? "",
      paragraphs: copy?.split.paragraphs ?? [],
      // A imagem entra pelo admin; até lá o renderizador desenha a moldura.
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
