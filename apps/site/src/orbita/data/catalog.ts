import {
  CATEGORIES,
  MENU_COLUMNS,
  RAW_TOOLS,
  solutionSlug,
  type CategoryId,
  type Feature,
  type Tool,
} from "@nerp/site-content";

/**
 * O catálogo da suíte, com os destinos do site resolvidos.
 *
 * Os dados moram em `@nerp/site-content` porque o `apps/web` também precisa
 * deles — é de lá que o admin semeia as páginas. O que fica aqui é o que é do
 * site: para onde cada ferramenta leva, e as duas leituras do catálogo.
 *
 * **As duas leituras.** O menu mostra as 28 ferramentas, em seis colunas por
 * momento do negócio. A cena mostra as 19 que são estação na órbita. É a mesma
 * lista, lida de dois jeitos — e é o que permite o menu crescer sem apertar a
 * animação.
 */

export type { CategoryId, Feature, Tool };
export { CATEGORIES, MENU_COLUMNS, RAW_TOOLS };

/**
 * O destino de cada solução.
 *
 * Continua valendo a regra de sempre: com URL o item vira link de verdade
 * (`http…` abre em aba nova, `/…` navega dentro do site); sem URL ele leva o
 * usuário até a estação da ferramenta na órbita e abre o modo produto.
 *
 * Todas apontam para a própria página interna, que existe para as 28 — gerada
 * do catálogo em `@nerp/site-content` e editável no admin. O NERP entrou nessa
 * conta: ele é a ponte com o ERP, mas é produto, e produto tem vitrine.
 */
export const TOOL_LINKS: Record<string, string | undefined> =
  Object.fromEntries(
    RAW_TOOLS.map((tool) => [tool.id, `/solucoes/${solutionSlug(tool.id)}`]),
  );

/** O catálogo com o destino já resolvido. */
export const TOOLS: Tool[] = RAW_TOOLS.map((tool) => ({
  ...tool,
  href: TOOL_LINKS[tool.id] ?? tool.href,
}));

export function findTool(id: string | null) {
  return id ? (TOOLS.find((tool) => tool.id === id) ?? null) : null;
}

/**
 * A ferramenta de uma página de solução, pelo slug da PÁGINA.
 *
 * O slug nem sempre é o id (`crm-tracking` é a página de `tracking`), e quem
 * está no site conhece o endereço, não o id. Serve ao Astro, que precisa saber
 * de que produto a pessoa está lendo para abrir a conversa nele.
 */
export function findToolBySlug(slug: string) {
  return TOOLS.find((tool) => solutionSlug(tool.id) === slug) ?? null;
}

/* ------------------------------------------------------------------ a cena */

/**
 * As estações da órbita. A cena deriva a geometria da CONTAGEM desta lista —
 * ângulo de cada esfera, janela de scroll de cada categoria — então ela não
 * pode crescer junto com o menu.
 */
export const ORBIT_TOOLS: Tool[] = TOOLS.filter(
  (tool) => tool.orbitStation !== false,
);

export const ORBIT_BY_CATEGORY = CATEGORIES.map((category) => ({
  ...category,
  tools: ORBIT_TOOLS.filter((tool) => tool.category === category.id),
}));

/* ------------------------------------------------------------------ o menu */

/** As colunas do painel, já com as ferramentas resolvidas. */
export const TOOLS_BY_COLUMN = MENU_COLUMNS.map((column) => ({
  title: column.title,
  tools: column.tools
    .map((id) => findTool(id))
    .filter((tool): tool is Tool => Boolean(tool)),
}));
