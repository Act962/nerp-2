import type { SiteBlock } from "./blocks";
import { CATEGORIES, findCatalogTool } from "./catalog";
import type { SitePageSeed } from "./pages";

/**
 * As páginas de "Sobre nós".
 *
 * **Aqui eu escrevi o mínimo, e isso é deliberado.** Estas cinco páginas
 * falam da empresa: história, vagas, cases, parceiros, trilhas de treinamento.
 * Nada disso está no catálogo nem em spec nenhum — inventar número de anos,
 * nome de parceiro ou depoimento de cliente seria colocar promessa no ar em
 * nome da ÓRBITA, e um case inventado é o tipo de coisa que destrói confiança
 * quando alguém confere.
 *
 * Então cada página nasce com:
 *
 * - o que é verdade e já existe no site (o nome, a frase de apoio, a suíte);
 * - a estrutura montada, com os blocos certos na ordem certa;
 * - os blocos que dependem de fato — cases, parceiros, vagas — DESLIGADOS e
 *   vazios, prontos no admin.
 *
 * Ligar um bloco desses é decisão de quem tem o fato na mão. O site fica menor
 * do que poderia, e verdadeiro.
 */

export type AboutPage = {
  id: string;
  slug: string;
  group: "Institucional" | "Parcerias" | "Destaque";
  name: string;
  summary: string;
};

export const ABOUT_PAGES: AboutPage[] = [
  {
    id: "sobre",
    slug: "sobre-o-orbita-hub",
    group: "Institucional",
    name: "Sobre o Órbita Hub",
    summary: "Quem somos e o que construímos",
  },
  {
    id: "trabalhe",
    slug: "trabalhe-conosco",
    group: "Institucional",
    name: "Trabalhe conosco",
    summary: "Vagas abertas e como é o time por dentro",
  },
  {
    id: "cases",
    slug: "cases-de-sucesso",
    group: "Parcerias",
    name: "Cases de sucesso",
    summary: "O que mudou na operação de quem usa",
  },
  {
    id: "parceiros",
    slug: "parceiros-e-integracoes",
    group: "Parcerias",
    name: "Parceiros e integrações",
    summary: "Quem revende, quem implanta e com o que a suíte conversa",
  },
  {
    id: "treinamentos",
    slug: "treinamentos",
    group: "Destaque",
    name: "Treinamentos",
    summary:
      "Trilhas para o time aprender a operar a suíte — do primeiro acesso ao uso avançado.",
  },
];

function baseBlocks(
  page: AboutPage,
  options: { whatsappHref: string },
): SiteBlock[] {
  return [
    {
      id: "hero",
      type: "hero",
      enabled: true,
      eyebrow: "Sobre nós",
      title: page.name,
      text: page.summary,
      primary: { label: "Falar com a gente", href: options.whatsappHref },
      secondary: { label: "", href: "" },
      image: { key: "", alt: "" },
    },
    {
      id: "contact",
      type: "contact",
      enabled: true,
      title: "Vamos conversar?",
      options: [
        {
          kind: "whatsapp",
          label: "Converse por WhatsApp",
          href: options.whatsappHref,
        },
      ],
    },
  ];
}

/** Um bloco de texto vazio, pronto no admin para receber o conteúdo real. */
function emptySplit(title: string): SiteBlock {
  return {
    id: "split",
    type: "split",
    enabled: false,
    title,
    paragraphs: [],
    image: { key: "", alt: "" },
    imageSide: "left",
  };
}

export function buildAboutPage(
  page: AboutPage,
  options: { whatsappHref: string },
): SitePageSeed {
  const [hero, contact] = baseBlocks(page, options);
  const blocks: SiteBlock[] = [hero];

  if (page.id === "sobre") {
    // As quatro frentes da suíte são fato: saem do catálogo, com o texto que
    // já é usado no site. É o único conteúdo institucional que posso afirmar.
    blocks.push({
      id: "statement",
      type: "statement",
      enabled: true,
      title: "Uma suíte, não um pacote de sistemas com a mesma cor.",
      text: "Vinte e oito ferramentas sobre a mesma base: o que uma escreve, a outra já enxerga.",
      cta: { label: "Conhecer as soluções", href: "/#solucoes" },
    });
    blocks.push({
      id: "features",
      type: "features",
      enabled: true,
      title: "As quatro frentes da suíte",
      items: CATEGORIES.map((category) => ({
        title: category.title,
        text: category.lead,
      })),
    });
    blocks.push(emptySplit("A história da ÓRBITA"));
  }

  if (page.id === "trabalhe") {
    blocks.push(emptySplit("Como é trabalhar aqui"));
    // As vagas são o conteúdo desta página, e elas mudam. Entram no admin.
    blocks.push({
      id: "features",
      type: "features",
      enabled: false,
      title: "Vagas abertas",
      items: [],
    });
  }

  if (page.id === "cases") {
    // Case é afirmação sobre cliente real: nunca nasce preenchido.
    blocks.push({
      id: "features",
      type: "features",
      enabled: false,
      title: "O que mudou na operação",
      items: [],
    });
    blocks.push({
      id: "clients",
      type: "clients",
      enabled: false,
      title: "Quem confia na ÓRBITA",
      logos: [],
    });
  }

  if (page.id === "parceiros") {
    blocks.push(emptySplit("Como funciona a parceria"));
    blocks.push({
      id: "clients",
      type: "clients",
      enabled: false,
      title: "Parceiros",
      logos: [],
    });
  }

  if (page.id === "treinamentos") {
    const route = findCatalogTool("route");
    if (route) {
      // Route existe e é "cursos e área de membros" — isto é fato do catálogo.
      blocks.push({
        id: "statement",
        type: "statement",
        enabled: true,
        title: "As trilhas rodam no Route, dentro da própria suíte.",
        text: route.summary,
        cta: { label: "Ver o Route", href: "/solucoes/route" },
      });
    }
    blocks.push({
      id: "features",
      type: "features",
      enabled: false,
      title: "Trilhas disponíveis",
      items: [],
    });
  }

  blocks.push(contact);

  return {
    section: "sobre",
    slug: page.slug,
    title: page.name,
    seoTitle: `${page.name} — ÓRBITA HUB`,
    seoDescription: page.summary,
    blocks,
  };
}

export function buildAllAboutPages(options: {
  whatsappHref: string;
}): SitePageSeed[] {
  return ABOUT_PAGES.map((page) => buildAboutPage(page, options));
}
