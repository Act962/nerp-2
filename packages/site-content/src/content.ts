/**
 * O conteúdo dos painéis da barra e dos ajustes do site.
 *
 * É o formato que `apps/web` devolve em `/api/site/content` e que `apps/site`
 * consome. Sem valores padrão aqui de propósito: o padrão é o catálogo que
 * vive dentro do `apps/site`, porque é ele quem sabe o que mostrar quando não
 * há nada no banco — e este pacote não conhece nem o banco nem a cena.
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

/**
 * O que `/api/site/content` devolve.
 *
 * Cada painel vem como está no banco — inclusive vazio. Quem recebe é que
 * decide o que fazer com o vazio; ver `applyFallback` no `apps/site`.
 */
export type SiteContentResponse = {
  solucoes: MenuGroup[];
  segmentos: MenuEntry[];
  sobre: {
    groups: MenuGroup[];
    highlight: (MenuEntry & { action: string }) | null;
  };
  stats: Array<{ value: string; label: string }>;
  contact: { email: string; phone: string } | null;
  whatsapp: { number: string; label: string } | null;
};

/** O que `/api/site/page/[slug]` devolve. */
export type SitePageResponse = {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  /** Já validados por `parseBlocks` do lado de quem serve. */
  blocks: unknown[];
};
