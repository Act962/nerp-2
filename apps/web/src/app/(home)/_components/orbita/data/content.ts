import { ABOUT_GROUPS, ABOUT_HIGHLIGHT, ABOUT_LINKS } from "./about";
import { TOOLS_BY_CATEGORY } from "./catalog";
import { SEGMENTS_WITH_LINKS } from "./segments";
import { STATS, WHATSAPP } from "./site";

/**
 * O conteúdo editável do site, num formato só.
 *
 * O que o admin controla são os PAINÉIS da barra, os números e o contato. A
 * órbita em si continua saindo de `catalog.ts`: as 19 estações são a própria
 * cena 3D — geometria, foco de câmera e roleta saem dali em tempo de módulo.
 * Trocar o menu não muda a cena; é essa a divisão.
 *
 * `DEFAULT_CONTENT` é o que o site mostra enquanto o banco estiver vazio, e é
 * o mesmo conteúdo de hoje. Assim o primeiro deploy não deixa o menu em branco
 * — e uma tabela apagada por acidente também não.
 */

export type MenuEntry = {
  /** Casa com o ícone desenhado e com a estação na órbita. */
  id: string;
  name: string;
  summary: string;
  href?: string;
  color?: string;
  /** Key de uma imagem no bucket, se alguém subiu um ícone próprio. */
  iconImage?: string;
};

export type MenuGroup = { title: string; items: MenuEntry[] };

export type SiteContent = {
  solucoes: MenuGroup[];
  segmentos: MenuEntry[];
  sobre: {
    groups: MenuGroup[];
    highlight: MenuEntry & { action: string };
  };
  stats: Array<{ value: string; label: string }>;
  contact: { email: string; phone: string };
  whatsapp: { number: string; href: string; label: string };
};

export const DEFAULT_CONTENT: SiteContent = {
  solucoes: TOOLS_BY_CATEGORY.map((group) => ({
    title: group.title,
    items: group.tools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      summary: tool.tagline,
      href: tool.href,
    })),
  })),
  segmentos: SEGMENTS_WITH_LINKS.map((segment) => ({
    id: segment.id,
    name: segment.name,
    summary: segment.summary,
    href: segment.href,
    color: segment.color,
  })),
  sobre: {
    groups: ABOUT_GROUPS.map((group) => ({
      title: group.title,
      items: group.items.map((item) => ({
        id: item.id,
        name: item.name,
        summary: item.summary,
        href: ABOUT_LINKS[item.id],
      })),
    })),
    highlight: {
      id: ABOUT_HIGHLIGHT.id,
      name: ABOUT_HIGHLIGHT.name,
      summary: ABOUT_HIGHLIGHT.summary,
      action: ABOUT_HIGHLIGHT.action,
      href: ABOUT_LINKS[ABOUT_HIGHLIGHT.id],
    },
  },
  stats: STATS,
  contact: { email: "contato@orbitahub.com.br", phone: "+55 (85) 0000-0000" },
  whatsapp: WHATSAPP,
};
