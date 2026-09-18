import type { AstroPagina } from "./astro-pagina";

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
  /**
   * As áreas da empresa a que a solução pertence (slugs). Só é preenchido nas
   * soluções; em Segmentos/Sobre fica ausente. Vazio = solução sem área ainda,
   * que só aparece no filtro "Todas".
   */
  areas?: string[];
};

export type MenuGroup = { title: string; items: MenuEntry[] };

/**
 * Uma área da empresa (Comercial, Financeiro, RH…). É o filtro do painel de
 * Soluções: cada botão é uma área, e "Todas" é o estado inicial. O admin edita
 * nome, ícone, cor e ordem; o site só desenha.
 */
export type SolutionArea = {
  /** = slug; mantido para casar com o formato de `MenuEntry`. */
  id: string;
  slug: string;
  name: string;
  iconKey?: string;
  iconImage?: string;
  color?: string;
};

export type SiteContent = {
  /**
   * Lista plana das soluções — o painel filtra por área no cliente. As áreas
   * do filtro vêm em `solutionAreas`; a antiga divisão em colunas editoriais
   * deixou de organizar a UX de Soluções.
   */
  solucoes: MenuEntry[];
  /** Os botões de área do painel de Soluções, na ordem de exibição. */
  solutionAreas: SolutionArea[];
  segmentos: MenuEntry[];
  sobre: {
    groups: MenuGroup[];
    highlight: MenuEntry & { action: string };
  };
  stats: Array<{ value: string; label: string }>;
  contact: { email: string; phone: string };
  whatsapp: { number: string; href: string; label: string };
  astro: AstroDisponibilidade;
};

/**
 * O que o site precisa saber sobre o consultor antes de desenhar o botão.
 *
 * Só dois booleanos, e nenhum deles é preço: o site nunca recebe a tabela —
 * ela é lida no servidor, na hora da estimativa. `precos` existe para o painel
 * não oferecer uma pergunta que o Astro não pode responder.
 */
export type AstroDisponibilidade = {
  /** Desligado, o botão do site vira o contato por WhatsApp. */
  ativo: boolean;
  /** Há faixa cadastrada, então dá para perguntar quanto custa. */
  precos: boolean;
};

/**
 * O que `/api/site/content` devolve.
 *
 * Cada painel vem como está no banco — inclusive vazio. Quem recebe é que
 * decide o que fazer com o vazio; ver `applyFallback` no `apps/site`.
 */
export type SiteContentResponse = {
  solucoes: MenuEntry[];
  solutionAreas: SolutionArea[];
  segmentos: MenuEntry[];
  sobre: {
    groups: MenuGroup[];
    highlight: (MenuEntry & { action: string }) | null;
  };
  stats: Array<{ value: string; label: string }>;
  contact: { email: string; phone: string } | null;
  whatsapp: { number: string; label: string } | null;
  /** Ausente numa resposta antiga: quem lê assume o consultor desligado. */
  astro?: AstroDisponibilidade;
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
  /**
   * O que o Astro fala nesta página. Ausente quando nada foi cadastrado —
   * e aí ele passa em silêncio por ela.
   */
  astro?: AstroPagina;
};
