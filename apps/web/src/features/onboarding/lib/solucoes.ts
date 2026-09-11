import type { PagePermissionKey } from "@/lib/permissions";

/**
 * As soluções que o wizard oferece — as ferramentas do catálogo do site que
 * existem dentro do nerp, cada uma amarrada ao módulo que a representa no
 * menu (`PAGE_PERMISSIONS`) e à tela onde ela começa.
 *
 * O `id` é o mesmo do `@nerp/site-content` quando existe lá (é o que deixa
 * o Astro relacionar "o que a pessoa marcou" com "o que o site vende"); os
 * que só existem no nerp (`astro`, `financeiro`, `pedidos`) têm id próprio.
 */

export const SOLUCAO_IDS = [
  "pdv",
  "estoque",
  "catalogo-promocional",
  "catalogo-online",
  "qr-preco",
  "pedidos",
  "financeiro",
  "whatsapp",
  "agenda",
  "ranking",
  "trade",
  "tradegram",
  "planograma",
  "book",
  "astro",
] as const;

export type SolucaoId = (typeof SOLUCAO_IDS)[number];

export interface SolucaoDef {
  id: SolucaoId;
  nome: string;
  descricao: string;
  /** Módulo do menu que a solução liga; `null` = sempre visível (Astro). */
  modulo: PagePermissionKey | null;
  href: string;
  /**
   * Quando esta solução passou a existir no catálogo, em AAAA-MM-DD.
   *
   * O nerp vai ganhar soluções novas, e quem entrou antes delas nunca as
   * escolheu no onboarding — não estão em `Organization.interests`, não sobem
   * com o selo "Para você" e não entram no guia. Sem esta data, a novidade
   * simplesmente não existiria para quem já é cliente.
   *
   * É ela que o motor de avisos compara com a data de criação da organização
   * para avisar, UMA vez, que apareceu coisa nova. Quem entrar depois não
   * recebe aviso nenhum: para essa pessoa não é novidade, é o catálogo.
   *
   * Ao acrescentar uma solução: ponha a data do dia e decida em
   * `nichos.ts` quais ramos a pré-marcam. O teste cobra as duas coisas.
   */
  desde: string;
}

/**
 * A data do catálogo de origem — tudo o que já existia quando o onboarding
 * guiado nasceu. Organização nenhuma é anterior a isto, então nada aqui vira
 * "novidade" para ninguém.
 */
export const CATALOGO_INICIAL = "2026-09-11";

export const SOLUCOES: SolucaoDef[] = [
  {
    id: "pdv",
    nome: "Frente de caixa (PDV)",
    descricao: "Venda no balcão, caixa e cupom.",
    modulo: "vendas",
    desde: CATALOGO_INICIAL,
    href: "/vendas/novo",
  },
  {
    id: "estoque",
    nome: "Estoque",
    descricao: "Entradas, movimentações, inventário e coletor.",
    modulo: "estoque",
    desde: CATALOGO_INICIAL,
    href: "/estoque",
  },
  {
    id: "catalogo-promocional",
    nome: "Catálogo promocional",
    descricao: "Encarte digital em PNG/PDF a partir das promoções.",
    modulo: "catalogo-promocional",
    desde: CATALOGO_INICIAL,
    href: "/catalogo-promocional",
  },
  {
    id: "catalogo-online",
    nome: "Catálogo online",
    descricao: "Loja online por subdomínio, com carrinho e checkout.",
    modulo: "catalogo",
    desde: CATALOGO_INICIAL,
    href: "/catalogo",
  },
  {
    id: "qr-preco",
    nome: "QR Preço",
    descricao: "O cliente escaneia na gôndola e vê o preço no celular.",
    modulo: "qr-preco",
    desde: CATALOGO_INICIAL,
    href: "/trade/qr-preco",
  },
  {
    id: "pedidos",
    nome: "Pedidos e cozinha",
    descricao: "Painel de pedidos para produção e entrega.",
    modulo: "pedidos",
    desde: CATALOGO_INICIAL,
    href: "/pedidos",
  },
  {
    id: "financeiro",
    nome: "Financeiro",
    descricao: "Contas a pagar e receber, fluxo de caixa.",
    modulo: "financeiro",
    desde: CATALOGO_INICIAL,
    href: "/financeiro",
  },
  {
    id: "whatsapp",
    nome: "WhatsApp e CRM",
    descricao: "Atendimento, funil, campanhas e automações.",
    modulo: "whatsapp",
    desde: CATALOGO_INICIAL,
    href: "/whatsapp",
  },
  {
    id: "agenda",
    nome: "Agenda",
    descricao: "Horários, marcação pública e lembretes.",
    modulo: "whatsapp",
    desde: CATALOGO_INICIAL,
    href: "/whatsapp/agenda",
  },
  {
    id: "ranking",
    nome: "Ranking de equipes",
    descricao: "Metas por vendedor e pódio no telão.",
    modulo: "ranking",
    desde: CATALOGO_INICIAL,
    href: "/ranking",
  },
  {
    id: "trade",
    nome: "Trade Marketing",
    descricao: "Lojas, mapas, calendário de ações e fotos de PDV.",
    modulo: "trade-painel",
    desde: CATALOGO_INICIAL,
    href: "/trade/painel",
  },
  {
    id: "tradegram",
    nome: "TradeGram",
    descricao: "Rede pública de lojas e indústrias.",
    modulo: "tradegram",
    desde: CATALOGO_INICIAL,
    href: "/trade/tradegram",
  },
  {
    id: "planograma",
    nome: "Planograma",
    descricao: "Como os produtos ficam na gôndola.",
    modulo: "planograma",
    desde: CATALOGO_INICIAL,
    href: "/trade/planograma",
  },
  {
    id: "book",
    nome: "Books de PDV",
    descricao: "Relatório fotográfico em PDF para a indústria.",
    modulo: "books",
    desde: CATALOGO_INICIAL,
    href: "/books",
  },
  {
    id: "astro",
    nome: "Astro",
    descricao:
      "A IA da sua operação: vendas, clientes, estoque e o que cada tela faz.",
    modulo: null,
    desde: CATALOGO_INICIAL,
    href: "/dashboard",
  },
];

export function solucaoPorId(id: string): SolucaoDef | null {
  return SOLUCOES.find((s) => s.id === id) ?? null;
}

export function ehSolucaoId(id: string): id is SolucaoId {
  return (SOLUCAO_IDS as readonly string[]).includes(id);
}

/**
 * As soluções que apareceram DEPOIS que esta organização existe.
 *
 * É o que transforma "o nerp ganhou uma ferramenta" em algo que o cliente
 * antigo fica sabendo. Quem entrou depois da solução não recebe nada: para
 * essa pessoa não é novidade, é o catálogo.
 *
 * Pura de propósito — recebe a data e devolve a lista, sem tocar em banco —,
 * porque é assim que o teste consegue fixar "hoje" e cobrar o comportamento.
 */
export function solucoesNovasPara(
  criadaEm: Date,
  solucoes: readonly SolucaoDef[] = SOLUCOES,
): SolucaoDef[] {
  const nascimento = criadaEm.toISOString().slice(0, 10);
  return solucoes
    .filter((solucao) => solucao.desde > nascimento)
    .sort((a, b) => (a.desde < b.desde ? 1 : -1));
}
