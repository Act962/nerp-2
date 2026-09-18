import type { SolutionArea } from "./content";

/**
 * As áreas da empresa que organizam o painel de Soluções.
 *
 * São o padrão do código — o fallback que vale quando o banco está vazio ou o
 * `apps/web` está fora do ar. O admin pode renomear, recolorir, reordenar e
 * acrescentar áreas; o que estiver no banco ganha deste catálogo.
 *
 * A ordem aqui é a ordem dos botões, e `position` no banco nasce deste índice.
 */
export const SOLUTION_AREAS: SolutionArea[] = [
  { id: "comercial", slug: "comercial", name: "Comercial", color: "#1e9dfb" },
  {
    id: "financeiro",
    slug: "financeiro",
    name: "Financeiro",
    color: "#16a34a",
  },
  { id: "rh", slug: "rh", name: "RH", color: "#f59e0b" },
  { id: "logistica", slug: "logistica", name: "Logística", color: "#8b5cf6" },
  {
    id: "administrativo",
    slug: "administrativo",
    name: "Administrativo",
    color: "#64748b",
  },
  { id: "marketing", slug: "marketing", name: "Marketing", color: "#ec4899" },
  {
    id: "operacional",
    slug: "operacional",
    name: "Operacional",
    color: "#0ea5e9",
  },
  { id: "juridico", slug: "juridico", name: "Jurídico", color: "#0d5c91" },
];

/**
 * A qual área cada ferramenta pertence, por padrão.
 *
 * É um ponto de partida defensável, não uma verdade fechada: quem cadastra
 * ajusta as atribuições pelo admin. RH e Jurídico nascem enxutas de propósito
 * — a suíte ainda não tem ferramenta dedicada a esses setores, e forçar uma só
 * para encher a coluna enganaria o visitante.
 */
export const AREA_BY_TOOL: Record<string, string[]> = {
  tracking: ["comercial"],
  chat: ["comercial"],
  forms: ["comercial", "marketing"],
  agendas: ["comercial"],
  forge: ["comercial", "juridico"],
  pdv: ["comercial", "operacional"],
  estoque: ["logistica", "operacional"],
  inventario: ["logistica", "operacional"],
  "catalogo-promocional": ["marketing", "operacional"],
  "qr-preco": ["operacional", "marketing"],
  "catalogo-online": ["comercial", "marketing", "operacional"],
  tradegram: ["operacional", "marketing"],
  planograma: ["operacional", "marketing"],
  book: ["marketing", "operacional"],
  nerp: ["operacional", "financeiro", "administrativo"],
  workspaces: ["administrativo", "operacional"],
  payment: ["financeiro"],
  nbox: ["administrativo"],
  ranking: ["comercial"],
  planner: ["marketing"],
  pages: ["marketing"],
  linnker: ["marketing"],
  comments: ["marketing"],
  disparo: ["marketing"],
  trafego: ["marketing"],
  astro: ["comercial", "operacional"],
  "space-station": ["rh", "administrativo"],
  route: ["rh", "marketing"],
};
