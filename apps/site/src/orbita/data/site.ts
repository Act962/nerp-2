import { legacy } from "../lib/timeline";

/** O WhatsApp comercial — botão flutuante, CTA da barra e painéis. */
export const WHATSAPP = {
  number: "558698221810",
  href: "https://wa.me/558698221810",
  label: "Agendar Demonstração",
};

export const BRAND = {
  name: "ÓRBITA",
  suffix: "HUB",
  tagline: "Tecnologia que orbita possibilidades.",
};

/**
 * A barra de navegação.
 *
 * `at` é o ponto da órbita para onde o item leva — a navegação move a câmera,
 * não rola até uma âncora. `mega` marca os itens que, em vez de viajar, abrem
 * um painel: a suíte em "Soluções", os setores em "Segmentos", a empresa em
 * "Sobre nós".
 */
export const NAV: Array<{
  label: string;
  href: string;
  at: number;
  /** Abre um painel em vez de viajar pela órbita. */
  mega?: "solucoes" | "segmentos" | "sobre";
}> = [
  { label: "Início", href: "#inicio", at: legacy(0.0) },
  { label: "Soluções", href: "#solucoes", at: legacy(0.3), mega: "solucoes" },
  {
    label: "Segmentos",
    href: "#segmentos",
    at: legacy(0.62),
    mega: "segmentos",
  },
  { label: "Sobre nós", href: "#sobre", at: legacy(0.86), mega: "sobre" },
  // Contato é o CTA final, que continua ancorado no fim da viagem.
  { label: "Contato", href: "#contato", at: 0.95 },
];

/*
  ATENÇÃO — números de placeholder.

  Estes quatro valores não vieram de nenhum spec: foram inventados para o
  leiaute. Trocar pelos reais antes de publicar, ou remover a seção "Sobre nós"
  do fallback. Nada mais no site afirma números.
*/
export const STATS = [
  { value: "+500", label: "Clientes atendidos" },
  { value: "+1200", label: "Projetos entregues" },
  { value: "+8 anos", label: "De mercado" },
  { value: "100%", label: "Foco no cliente" },
];

/*
  As colunas saem do catálogo real da suíte, não de uma lista de marketing.
  Antes havia aqui "Órbita CRM", "Órbita Store" e "Órbita Pay" — produtos que
  não existem. Agora são as ferramentas que existem, agrupadas como na órbita.
*/
export const FOOTER = {
  columns: [
    {
      title: "O cliente chega e avança",
      links: ["Tracking", "Chat", "Forms", "Agendas", "Forge"],
    },
    {
      title: "A casa funciona por dentro",
      links: ["Workspaces", "Payment", "N-box", "Ranking"],
    },
    {
      title: "A empresa aparece e capta",
      links: ["Planner", "Pages", "Linnker", "Comments", "Disparo"],
    },
    {
      title: "O que só existe aqui",
      links: ["Astro", "Space Station", "Route", "TradeGram", "NERP"],
    },
  ],
  contact: {
    title: "Contato",
    email: "contato@orbitahub.com.br",
    phone: "+55 (85) 0000-0000",
    social: [
      { label: "LinkedIn", href: "#" },
      { label: "Instagram", href: "#" },
    ],
  },
};
