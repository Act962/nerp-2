import "server-only";

import prisma from "@/lib/db";
import { avisosDoVendedor } from "./avisos";
import { garantirPerfil } from "./configuracao";
import type { ContextoVendedor } from "./escopo-equipe";

const ENVIADOS = ["PENDING_APPROVAL", "CONFIRMED", "COMPLETED"] as const;

async function somaVendida(
  organizationId: string,
  memberId: string,
  desde: Date,
) {
  const soma = await prisma.sale.aggregate({
    where: {
      organizationId,
      origin: "FORCA_VENDAS",
      sellerMemberId: memberId,
      status: { in: [...ENVIADOS] },
      createdAt: { gte: desde },
    },
    _sum: { total: true },
    _count: true,
  });
  return { total: Number(soma._sum.total ?? 0), pedidos: soma._count };
}

/** Tudo que a home do módulo mostra, numa chamada só. */
export async function dadosDaInicio(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
}) {
  const { organizationId, vendedor } = args;
  const agora = new Date();
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  const mes = new Date(agora.getFullYear(), agora.getMonth(), 1);

  const [perfil, org, dia, doMes, aguardando, metas, avisos, carteira] =
    await Promise.all([
      garantirPerfil(organizationId, vendedor.memberId),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, logo: true },
      }),
      somaVendida(organizationId, vendedor.memberId, hoje),
      somaVendida(organizationId, vendedor.memberId, mes),
      prisma.sale.count({
        where: {
          organizationId,
          origin: "FORCA_VENDAS",
          sellerMemberId: vendedor.memberId,
          status: "PENDING_APPROVAL",
        },
      }),
      // Meta do mês vinda do Ranking de Equipes, quando o vendedor está vinculado.
      prisma.salesGoalEntry.aggregate({
        where: {
          memberId: vendedor.memberId,
          branch: {
            period: {
              organizationId,
              periodStart: { lte: agora },
              periodEnd: { gte: agora },
            },
          },
        },
        _sum: { goalAmount: true },
      }),
      avisosDoVendedor({ organizationId, memberId: vendedor.memberId }),
      prisma.carteiraCliente.count({
        where: { organizationId, memberId: vendedor.memberId },
      }),
    ]);

  const meta = Number(metas._sum.goalAmount ?? 0);
  const pendentes = avisos.filter((aviso) => aviso.pendente);
  const prioridade = { URGENTE: 0, IMPORTANTE: 1, NORMAL: 2 } as const;
  const destaque =
    [...pendentes].sort(
      (a, b) => prioridade[a.prioridade] - prioridade[b.prioridade],
    )[0] ?? null;

  return {
    nome: vendedor.nome,
    imagem: vendedor.imagem,
    organizacao: { nome: org?.name ?? "", logo: org?.logo ?? null },
    ehGestor: vendedor.ehGestor,
    vendidoHoje: dia.total,
    pedidosHoje: dia.pedidos,
    vendidoMes: doMes.total,
    pedidosMes: doMes.pedidos,
    meta: meta > 0 ? meta : null,
    saldoFlex: Number(perfil.saldoFlex),
    pedidosAguardando: aguardando,
    clientesNaCarteira: carteira,
    avisosPendentes: pendentes.length,
    avisoDestaque: destaque,
  };
}

export async function extratoFlex(args: {
  organizationId: string;
  memberId: string;
}) {
  const perfil = await garantirPerfil(args.organizationId, args.memberId);
  const lancamentos = await prisma.lancamentoFlex.findMany({
    where: { organizationId: args.organizationId, perfilId: perfil.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      tipo: true,
      valor: true,
      saldoApos: true,
      descricao: true,
      createdAt: true,
      saleId: true,
    },
  });
  return {
    saldo: Number(perfil.saldoFlex),
    lancamentos: lancamentos.map((lancamento) => ({
      id: lancamento.id,
      tipo: lancamento.tipo,
      valor: Number(lancamento.valor),
      saldoApos: Number(lancamento.saldoApos),
      descricao: lancamento.descricao,
      data: lancamento.createdAt.toISOString(),
      saleId: lancamento.saleId,
    })),
  };
}
