import type { SolucaoId } from "./solucoes";

/**
 * O guia de uso: passos fixos por solução de interesse, cada um com a tela
 * onde acontece e uma regra estática de "feito" sobre contagens que o
 * servidor já devolve. Nada aqui chama IA.
 */

export interface StatusDoGuia {
  vendas: number;
  produtosReais: number;
  catalogos: number;
  catalogosExportados: number;
  conversasComAstro: number;
  whatsappConectado: boolean;
  campanhas: number;
  eventos: number;
  clientesReais: number;
  metas: number;
  lojas: number;
  fotosPdv: number;
}

export interface PassoDoGuia {
  id: string;
  titulo: string;
  href: string;
  feito: (s: StatusDoGuia) => boolean;
}

const PASSOS: Partial<Record<SolucaoId, PassoDoGuia[]>> = {
  pdv: [
    {
      id: "pdv-venda",
      titulo: "Faça uma venda de teste no PDV",
      href: "/vendas/novo",
      feito: (s) => s.vendas > 0,
    },
  ],
  estoque: [
    {
      id: "estoque-produto",
      titulo: "Cadastre seu primeiro produto de verdade",
      href: "/produtos/novo",
      feito: (s) => s.produtosReais > 0,
    },
    {
      id: "estoque-entrada",
      titulo: "Veja as movimentações de estoque",
      href: "/estoque/movimentacoes",
      feito: (s) => s.vendas > 0,
    },
  ],
  "catalogo-promocional": [
    {
      id: "catalogo-abrir",
      titulo: "Abra o catálogo Ofertas da semana",
      href: "/catalogo-promocional",
      feito: (s) => s.catalogos > 0,
    },
    {
      id: "catalogo-exportar",
      titulo: "Exporte o catálogo em PDF",
      href: "/catalogo-promocional",
      feito: (s) => s.catalogosExportados > 0,
    },
  ],
  "catalogo-online": [
    {
      id: "online-abrir",
      titulo: "Configure sua loja online",
      href: "/catalogo",
      feito: () => false,
    },
  ],
  whatsapp: [
    {
      id: "whatsapp-conectar",
      titulo: "Conecte seu número do WhatsApp",
      href: "/whatsapp/conexao",
      feito: (s) => s.whatsappConectado,
    },
    {
      id: "whatsapp-campanha",
      titulo: "Monte sua primeira campanha",
      href: "/whatsapp/campanhas",
      feito: (s) => s.campanhas > 0,
    },
  ],
  agenda: [
    {
      id: "agenda-abrir",
      titulo: "Abra a agenda e veja os horários",
      href: "/whatsapp/agenda",
      feito: () => false,
    },
  ],
  ranking: [
    {
      id: "ranking-metas",
      titulo: "Veja o ranking com metas de exemplo",
      href: "/ranking",
      feito: (s) => s.metas > 0,
    },
  ],
  trade: [
    {
      id: "trade-loja",
      titulo: "Abra a loja de exemplo e o mapa",
      href: "/lojas",
      feito: (s) => s.lojas > 0,
    },
    {
      id: "trade-calendario",
      titulo: "Veja as ações no calendário",
      href: "/trade/calendario",
      feito: (s) => s.eventos > 0,
    },
    {
      id: "trade-foto",
      titulo: "Registre uma foto de PDV",
      href: "/promotor",
      feito: (s) => s.fotosPdv > 0,
    },
  ],
  book: [
    {
      id: "book-abrir",
      titulo: "Monte um book com fotos de PDV",
      href: "/books",
      feito: (s) => s.fotosPdv > 0,
    },
  ],
  astro: [
    {
      id: "astro-vendas",
      titulo: "Pergunte ao Astro quanto vendeu hoje",
      href: "/dashboard",
      feito: (s) => s.conversasComAstro > 0,
    },
  ],
};

const PASSOS_BASE: PassoDoGuia[] = [
  {
    id: "base-cliente",
    titulo: "Cadastre um cliente de verdade",
    href: "/clientes",
    feito: (s) => s.clientesReais > 0,
  },
];

export function passosDoGuia(interesses: readonly string[]): PassoDoGuia[] {
  const escolhidos = interesses.flatMap((id) => PASSOS[id as SolucaoId] ?? []);
  const semRepetir = new Map<string, PassoDoGuia>();
  for (const passo of [...escolhidos, ...PASSOS_BASE])
    semRepetir.set(passo.id, passo);
  return [...semRepetir.values()];
}

export type PassoAvaliado = Omit<PassoDoGuia, "feito"> & { feito: boolean };

export function progressoDoGuia(
  interesses: readonly string[],
  status: StatusDoGuia,
): { passos: PassoAvaliado[]; feitos: number; total: number } {
  const passos = passosDoGuia(interesses).map((p) => ({
    ...p,
    feito: p.feito(status),
  }));
  return {
    passos,
    feitos: passos.filter((p) => p.feito).length,
    total: passos.length,
  };
}
