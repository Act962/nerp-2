import { SEGMENTS, type Segment } from "@nerp/site-content";

/**
 * Os segmentos, com o destino de cada card.
 *
 * A lista em si mora em `@nerp/site-content` porque o `apps/web` também
 * precisa dela para semear o banco. O que fica aqui é o que é do site: para
 * onde o card leva.
 */

export type { Segment };
export { SEGMENTS };

/** Todo segmento tem página própria, editável no admin. */
export const SEGMENT_LINKS: Record<string, string | undefined> =
  Object.fromEntries(
    SEGMENTS.map((segment) => [segment.id, `/segmentos/${segment.id}`]),
  );

export const SEGMENTS_WITH_LINKS = SEGMENTS.map((segment) => ({
  ...segment,
  href: SEGMENT_LINKS[segment.id],
}));
