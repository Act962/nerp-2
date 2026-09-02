import { ABOUT_PAGES } from "@nerp/site-content";

/**
 * O painel "Sobre nós".
 *
 * Duas listas curtas e um destaque. Treinamentos não tem sub-itens: como
 * coluna, o título repetiria o próprio link logo abaixo. Em destaque, ele vira
 * o convite do painel.
 *
 * Os itens saem de `@nerp/site-content`, que é a mesma lista que o `apps/web`
 * usa para semear o banco — o painel e as páginas não podem divergir.
 */

export type AboutItem = {
  id: string;
  name: string;
  summary: string;
  href?: string;
};

export type AboutGroup = {
  id: string;
  title: string;
  items: AboutItem[];
};

/** Toda página de "Sobre nós" existe; o destino é sempre o próprio slug. */
export const ABOUT_LINKS: Record<string, string | undefined> =
  Object.fromEntries(
    ABOUT_PAGES.map((page) => [page.id, `/sobre/${page.slug}`]),
  );

const AGRUPAVEIS = ABOUT_PAGES.filter((page) => page.group !== "Destaque");

export const ABOUT_GROUPS: AboutGroup[] = ["Institucional", "Parcerias"].map(
  (titulo) => ({
    id: titulo.toLowerCase(),
    title: titulo,
    items: AGRUPAVEIS.filter((page) => page.group === titulo).map((page) => ({
      id: page.id,
      name: page.name,
      summary: page.summary,
      href: ABOUT_LINKS[page.id],
    })),
  }),
);

/** O bloco em destaque, à direita das duas listas. */
const destaque = ABOUT_PAGES.find((page) => page.group === "Destaque");

export const ABOUT_HIGHLIGHT = {
  id: destaque?.id ?? "treinamentos",
  name: destaque?.name ?? "Treinamentos",
  summary: destaque?.summary ?? "",
  action: "Ver as trilhas",
};
