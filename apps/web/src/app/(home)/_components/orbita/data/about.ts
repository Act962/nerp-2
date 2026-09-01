/**
 * O painel "Sobre nós".
 *
 * Duas listas curtas e um destaque. Treinamentos não tem sub-itens: como
 * coluna, o título repetiria o próprio link logo abaixo dele. Em destaque,
 * ele vira o convite do painel — e o painel ganha o peso que duas colunas
 * soltas não dariam.
 *
 * Os textos de apoio são de redação, não de spec: revise antes de publicar.
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

export const ABOUT_GROUPS: AboutGroup[] = [
  {
    id: "institucional",
    title: "Institucional",
    items: [
      {
        id: "sobre",
        name: "Sobre o Órbita Hub",
        summary: "Quem somos e o que construímos",
      },
      {
        id: "trabalhe",
        name: "Trabalhe conosco",
        summary: "Vagas abertas e como é o time por dentro",
      },
    ],
  },
  {
    id: "parcerias",
    title: "Parcerias",
    items: [
      {
        id: "cases",
        name: "Cases de sucesso",
        summary: "O que mudou na operação de quem usa",
      },
      {
        id: "parceiros",
        name: "Parceiros e integrações",
        summary: "Quem revende, quem implanta e com o que a suíte conversa",
      },
    ],
  },
];

/** O bloco em destaque, à direita das duas listas. */
export const ABOUT_HIGHLIGHT = {
  id: "treinamentos",
  name: "Treinamentos",
  summary:
    "Trilhas para o time aprender a operar a suíte — do primeiro acesso ao uso avançado.",
  action: "Ver as trilhas",
};

/**
 * Onde cada item leva — o lugar para colar as URLs.
 *
 * Mesma regra de `TOOL_LINKS` e `SEGMENT_LINKS`: com URL o item vira link de
 * verdade; sem URL ele leva ao WhatsApp comercial, que existe hoje.
 *
 * `treinamentos` pode apontar para o Route, que já é "cursos e área de
 * membros" da suíte, se a página pública dele for essa.
 */
export const ABOUT_LINKS: Record<string, string | undefined> = {
  // sobre: "/sobre",
  // trabalhe: "/trabalhe-conosco",
  // cases: "/cases",
  // parceiros: "/parceiros",
  // treinamentos: "/treinamentos",
};
