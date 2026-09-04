import type { AstroPagina } from "@nerp/site-content";

/**
 * A página onde o visitante está, do jeito que o Astro precisa saber.
 *
 * Vive num arquivo próprio porque atravessa a árvore inteira — da rota até o
 * widget, passando por componentes que não têm nada a ver com o mascote.
 */
export type PaginaDoAstro = {
  slug: string;
  titulo: string;
  config: AstroPagina;
};
