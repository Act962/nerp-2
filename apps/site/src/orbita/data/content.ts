import type { MenuEntry, MenuGroup, SiteContent } from "@nerp/site-content";
import { ABOUT_GROUPS, ABOUT_HIGHLIGHT, ABOUT_LINKS } from "./about";
import { TOOLS_BY_COLUMN } from "./catalog";
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
 * `DEFAULT_CONTENT` é o que o site mostra quando o `apps/web` não responde ou
 * ainda não tem nada cadastrado, e é o mesmo conteúdo de hoje. É o que faz o
 * site continuar de pé com o ERP fora do ar — e o que impede o primeiro deploy
 * de mostrar um menu vazio.
 *
 * Os tipos vêm de `@nerp/site-content`, que é o contrato entre os dois apps.
 */

export type { MenuEntry, MenuGroup, SiteContent };

export const DEFAULT_CONTENT: SiteContent = {
  solucoes: TOOLS_BY_COLUMN.map((group) => ({
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
