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
}

export const SOLUCOES: SolucaoDef[] = [
  {
    id: "pdv",
    nome: "Frente de caixa (PDV)",
    descricao: "Venda no balcão, caixa e cupom.",
    modulo: "vendas",
    href: "/vendas/novo",
  },
  {
    id: "estoque",
    nome: "Estoque",
    descricao: "Entradas, movimentações, inventário e coletor.",
    modulo: "estoque",
    href: "/estoque",
  },
  {
    id: "catalogo-promocional",
    nome: "Catálogo promocional",
    descricao: "Encarte digital em PNG/PDF a partir das promoções.",
    modulo: "catalogo-promocional",
    href: "/catalogo-promocional",
  },
  {
    id: "catalogo-online",
    nome: "Catálogo online",
    descricao: "Loja online por subdomínio, com carrinho e checkout.",
    modulo: "catalogo",
    href: "/catalogo",
  },
  {
    id: "qr-preco",
    nome: "QR Preço",
    descricao: "O cliente escaneia na gôndola e vê o preço no celular.",
    modulo: "qr-preco",
    href: "/trade/qr-preco",
  },
  {
    id: "pedidos",
    nome: "Pedidos e cozinha",
    descricao: "Painel de pedidos para produção e entrega.",
    modulo: "pedidos",
    href: "/pedidos",
  },
  {
    id: "financeiro",
    nome: "Financeiro",
    descricao: "Contas a pagar e receber, fluxo de caixa.",
    modulo: "financeiro",
    href: "/financeiro",
  },
  {
    id: "whatsapp",
    nome: "WhatsApp e CRM",
    descricao: "Atendimento, funil, campanhas e automações.",
    modulo: "whatsapp",
    href: "/whatsapp",
  },
  {
    id: "agenda",
    nome: "Agenda",
    descricao: "Horários, marcação pública e lembretes.",
    modulo: "whatsapp",
    href: "/whatsapp/agenda",
  },
  {
    id: "ranking",
    nome: "Ranking de equipes",
    descricao: "Metas por vendedor e pódio no telão.",
    modulo: "ranking",
    href: "/ranking",
  },
  {
    id: "trade",
    nome: "Trade Marketing",
    descricao: "Lojas, mapas, calendário de ações e fotos de PDV.",
    modulo: "trade-painel",
    href: "/trade/painel",
  },
  {
    id: "tradegram",
    nome: "TradeGram",
    descricao: "Rede pública de lojas e indústrias.",
    modulo: "tradegram",
    href: "/trade/tradegram",
  },
  {
    id: "planograma",
    nome: "Planograma",
    descricao: "Como os produtos ficam na gôndola.",
    modulo: "planograma",
    href: "/trade/planograma",
  },
  {
    id: "book",
    nome: "Books de PDV",
    descricao: "Relatório fotográfico em PDF para a indústria.",
    modulo: "books",
    href: "/books",
  },
  {
    id: "astro",
    nome: "Astro",
    descricao:
      "A IA da sua operação: vendas, clientes, estoque e o que cada tela faz.",
    modulo: null,
    href: "/dashboard",
  },
];

export function solucaoPorId(id: string): SolucaoDef | null {
  return SOLUCOES.find((s) => s.id === id) ?? null;
}

export function ehSolucaoId(id: string): id is SolucaoId {
  return (SOLUCAO_IDS as readonly string[]).includes(id);
}
