/**
 * O endereço público de uma página do site.
 *
 * O site institucional é outro app (`apps/site`), em outra porta e outro
 * domínio — por isso o link de pré-visualização é absoluto. Sem
 * `NEXT_PUBLIC_SITE_URL`, o padrão é a porta de desenvolvimento dele.
 */

export const SECTION_URL = {
  SOLUCOES: "solucoes",
  SEGMENTOS: "segmentos",
  SOBRE: "sobre",
} as const;

export type SiteSectionKey = keyof typeof SECTION_URL;

export const SECTION_LABEL = {
  SOLUCOES: "Soluções",
  SEGMENTOS: "Segmentos",
  SOBRE: "Sobre nós",
} as const;

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"
).replace(/\/$/, "");

/** O caminho da página dentro do site: `/segmentos/clinicas`. */
export function sitePath(section: SiteSectionKey, slug: string) {
  return `/${SECTION_URL[section]}/${slug}`;
}

/** O endereço completo, para abrir em outra aba a partir do admin. */
export function siteUrl(section: SiteSectionKey, slug: string) {
  return `${SITE_URL}${sitePath(section, slug)}`;
}
