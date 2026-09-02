import {
  buildAllAboutPages,
  buildAllSegmentPages,
  buildAllSolutionPages,
  buildMetodoPage,
  type SiteSection,
  type SitePageSeed,
} from "@nerp/site-content";
import { WHATSAPP } from "../orbita/data/site";

/**
 * As páginas que já existem no código.
 *
 * Mesma ideia do `DEFAULT_CONTENT`: o site mostra a página mesmo com o
 * `apps/web` desligado ou com o banco ainda vazio. O que estiver PUBLICADO no
 * admin ganha destas — aqui é o ponto de partida, e é o que permite trabalhar
 * o leiaute sem depender de banco nenhum.
 *
 * As três famílias nascem do mesmo gerador que o `apps/web` usa para semear o
 * banco, então as duas pontas não divergem.
 */
const opcoes = { whatsappHref: WHATSAPP.href };

// O NERP fica de fora das soluções: é a ponte com o ERP, leva ao login e não
// tem página de vitrine.
const PAGES: SitePageSeed[] = [
  ...buildAllSolutionPages(opcoes).filter((page) => page.toolId !== "nerp"),
  ...buildAllSegmentPages(opcoes),
  ...buildAllAboutPages(opcoes),
  buildMetodoPage(opcoes),
];

export type { SitePageSeed };

/**
 * A seção faz parte da identidade da página: sem ela, `/solucoes/supermercados`
 * abriria o segmento, e o mesmo conteúdo existiria em dois endereços.
 */
export function findDefaultPage(
  section: SiteSection,
  slug: string,
): SitePageSeed | null {
  return (
    PAGES.find((page) => page.section === section && page.slug === slug) ?? null
  );
}
