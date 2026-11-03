import "server-only";

import { ORPCError } from "@orpc/server";
import type { DestinoPedido, PaymentMethod } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { garantirPerfil, obterConfiguracao } from "./configuracao";
import {
  type ContextoVendedor,
  filtroDeMembro,
  membroNoEscopo,
} from "./escopo-equipe";

function naoEncontrado(message: string): never {
  throw new ORPCError("NOT_FOUND", { message });
}

function exigirMembroNoEscopo(gestor: ContextoVendedor, memberId: string) {
  if (!membroNoEscopo(gestor.escopo, memberId))
    naoEncontrado("Vendedor não encontrado");
}

// ── Vendedores ───────────────────────────────────────────────────────────────

/**
 * Quem aparece como vendedor no painel: quem já tem perfil no módulo, quem tem
 * a permissão do app e quem tem o cargo VENDEDOR no Trade.
 */
export async function listarVendedores(args: {
  organizationId: string;
  gestor: ContextoVendedor;
}) {
  const filtro = filtroDeMembro(args.gestor.escopo);
  const membros = await prisma.member.findMany({
    where: {
      organizationId: args.organizationId,
      ...(filtro ? { id: filtro } : {}),
      OR: [
        { vendedorPerfil: { isNot: null } },
        { permissions: { has: "forca-vendas" } },
        { tradeRole: "VENDEDOR" },
      ],
    },
    orderBy: { user: { name: "asc" } },
    select: {
      id: true,
      tradeRole: true,
      user: { select: { name: true, email: true, image: true } },
      supervisor: { select: { user: { select: { name: true } } } },
      vendedorPerfil: true,
      _count: { select: { carteiraClientes: true } },
    },
  });
  return membros.map((membro) => {
    const perfil = membro.vendedorPerfil;
    return {
      memberId: membro.id,
      nome: membro.user.name,
      email: membro.user.email,
      imagem: membro.user.image,
      cargo: membro.tradeRole,
      supervisor: membro.supervisor?.user.name ?? null,
      clientes: membro._count.carteiraClientes,
      ativo: perfil?.ativo ?? true,
      codigo: perfil?.codigo ?? null,
      descontoMaximoPercent:
        perfil?.descontoMaximoPercent != null
          ? Number(perfil.descontoMaximoPercent)
          : null,
      flexLimiteNegativo:
        perfil?.flexLimiteNegativo != null
          ? Number(perfil.flexLimiteNegativo)
          : null,
      saldoFlex: perfil ? Number(perfil.saldoFlex) : 0,
      ultimaPosicao:
        perfil?.ultimaLatitude != null &&
        perfil.ultimaLongitude != null &&
        perfil.ultimaPosicaoEm
          ? {
              latitude: perfil.ultimaLatitude,
              longitude: perfil.ultimaLongitude,
              precisaoM: perfil.ultimaPrecisaoM,
              bateria: perfil.ultimaBateria,
              em: perfil.ultimaPosicaoEm.toISOString(),
            }
          : null,
    };
  });
}

export async function atualizarVendedor(args: {
  organizationId: string;
  gestor: ContextoVendedor;
  memberId: string;
  ativo: boolean;
  codigo?: string | null;
  descontoMaximoPercent?: number | null;
  flexLimiteNegativo?: number | null;
}) {
  exigirMembroNoEscopo(args.gestor, args.memberId);
  const membro = await prisma.member.findFirst({
    where: { id: args.memberId, organizationId: args.organizationId },
    select: { id: true },
  });
  if (!membro) naoEncontrado("Vendedor não encontrado");
  const perfil = await garantirPerfil(args.organizationId, args.memberId);
  await prisma.vendedorPerfil.update({
    where: { id: perfil.id },
    data: {
      ativo: args.ativo,
      codigo: args.codigo?.trim() || null,
      descontoMaximoPercent: args.descontoMaximoPercent ?? null,
      flexLimiteNegativo: args.flexLimiteNegativo ?? null,
    },
  });
}

/** Crédito ou débito manual no flex, sempre com lançamento no extrato. */
export async function ajustarFlex(args: {
  organizationId: string;
  gestor: ContextoVendedor;
  memberId: string;
  valor: number;
  descricao: string;
}) {
  exigirMembroNoEscopo(args.gestor, args.memberId);
  if (!args.gestor.podeAprovar) {
    throw new ORPCError("FORBIDDEN", {
      message: "Você não pode ajustar o flex",
    });
  }
  const perfil = await garantirPerfil(args.organizationId, args.memberId);
  await prisma.$transaction(async (tx) => {
    const saldo = await tx.vendedorPerfil.update({
      where: { id: perfil.id },
      data: { saldoFlex: { increment: args.valor } },
      select: { saldoFlex: true },
    });
    await tx.lancamentoFlex.create({
      data: {
        organizationId: args.organizationId,
        perfilId: perfil.id,
        tipo: "AJUSTE",
        valor: args.valor,
        saldoApos: saldo.saldoFlex,
        descricao: args.descricao.trim(),
        criadoPorId: args.gestor.userId,
      },
    });
  });
}

// ── Carteiras ────────────────────────────────────────────────────────────────

export async function clientesParaCarteira(args: {
  organizationId: string;
  memberId: string;
  busca?: string | null;
  cidade?: string | null;
  situacao: "DA_CARTEIRA" | "SEM_CARTEIRA" | "TODOS";
  cursor?: string | null;
  limite: number;
}) {
  const busca = args.busca?.trim();
  const clientes = await prisma.customer.findMany({
    where: {
      organizationId: args.organizationId,
      isActive: true,
      ...(args.cidade
        ? { city: { equals: args.cidade, mode: "insensitive" } }
        : {}),
      ...(args.situacao === "DA_CARTEIRA"
        ? { carteiras: { some: { memberId: args.memberId } } }
        : args.situacao === "SEM_CARTEIRA"
          ? { carteiras: { none: {} } }
          : {}),
      ...(busca
        ? {
            OR: [
              { name: { contains: busca, mode: "insensitive" } },
              { tradeName: { contains: busca, mode: "insensitive" } },
              { document: { contains: busca } },
              { city: { contains: busca, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: args.limite + 1,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      tradeName: true,
      city: true,
      document: true,
      carteiras: {
        select: {
          memberId: true,
          member: { select: { user: { select: { name: true } } } },
        },
      },
    },
  });
  const temMais = clientes.length > args.limite;
  const pagina = temMais ? clientes.slice(0, args.limite) : clientes;
  return {
    clientes: pagina.map((cliente) => ({
      id: cliente.id,
      nome: cliente.tradeName || cliente.name,
      razaoSocial: cliente.name,
      cidade: cliente.city,
      documento: cliente.document,
      naCarteira: cliente.carteiras.some(
        (carteira) => carteira.memberId === args.memberId,
      ),
      vendedores: cliente.carteiras.map(
        (carteira) => carteira.member.user.name,
      ),
    })),
    proximoCursor: temMais ? (pagina.at(-1)?.id ?? null) : null,
  };
}

export async function cidadesDosClientes(organizationId: string) {
  const linhas = await prisma.customer.groupBy({
    by: ["city"],
    where: { organizationId, isActive: true, city: { not: null } },
    _count: true,
    orderBy: { city: "asc" },
  });
  return linhas.flatMap((linha) =>
    linha.city ? [{ cidade: linha.city, clientes: linha._count }] : [],
  );
}

export async function atribuirCarteira(args: {
  organizationId: string;
  gestor: ContextoVendedor;
  memberId: string;
  customerIds: string[];
  /** Atribui todos os clientes ativos da cidade, além dos ids. */
  cidade?: string | null;
}) {
  exigirMembroNoEscopo(args.gestor, args.memberId);
  const membro = await prisma.member.findFirst({
    where: { id: args.memberId, organizationId: args.organizationId },
    select: { id: true },
  });
  if (!membro) naoEncontrado("Vendedor não encontrado");

  const clientes = await prisma.customer.findMany({
    where: {
      organizationId: args.organizationId,
      OR: [
        { id: { in: args.customerIds } },
        ...(args.cidade
          ? [
              {
                city: { equals: args.cidade, mode: "insensitive" as const },
                isActive: true,
              },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      carteiras: { where: { principal: true }, select: { id: true } },
    },
  });
  const { count } = await prisma.carteiraCliente.createMany({
    data: clientes.map((cliente) => ({
      organizationId: args.organizationId,
      customerId: cliente.id,
      memberId: args.memberId,
      // O primeiro vendedor do cliente vira o principal (dono das conversas).
      principal: cliente.carteiras.length === 0,
    })),
    skipDuplicates: true,
  });
  await garantirPerfil(args.organizationId, args.memberId);
  return { adicionados: count };
}

export async function removerDaCarteira(args: {
  organizationId: string;
  gestor: ContextoVendedor;
  memberId: string;
  customerIds: string[];
}) {
  exigirMembroNoEscopo(args.gestor, args.memberId);
  const { count } = await prisma.carteiraCliente.deleteMany({
    where: {
      organizationId: args.organizationId,
      memberId: args.memberId,
      customerId: { in: args.customerIds },
    },
  });
  return { removidos: count };
}

// ── Mapa ─────────────────────────────────────────────────────────────────────

export async function mapaAoVivo(args: {
  organizationId: string;
  gestor: ContextoVendedor;
}) {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const filtro = filtroDeMembro(args.gestor.escopo);
  const [vendedores, jornadas, visitas] = await Promise.all([
    listarVendedores(args),
    prisma.jornadaVendedor.findMany({
      where: {
        organizationId: args.organizationId,
        encerradaEm: null,
        ...(filtro ? { memberId: filtro } : {}),
      },
      select: { memberId: true, iniciadaEm: true },
    }),
    prisma.visitaCliente.groupBy({
      by: ["memberId"],
      where: {
        organizationId: args.organizationId,
        checkinEm: { gte: inicio },
        ...(filtro ? { memberId: filtro } : {}),
      },
      _count: true,
    }),
  ]);
  const jornadaPor = new Map(
    jornadas.map((jornada) => [jornada.memberId, jornada.iniciadaEm]),
  );
  const visitasPor = new Map(
    visitas.map((linha) => [linha.memberId, linha._count]),
  );
  return vendedores.map((vendedor) => ({
    memberId: vendedor.memberId,
    nome: vendedor.nome,
    imagem: vendedor.imagem,
    ultimaPosicao: vendedor.ultimaPosicao,
    jornadaDesde: jornadaPor.get(vendedor.memberId)?.toISOString() ?? null,
    visitasHoje: visitasPor.get(vendedor.memberId) ?? 0,
  }));
}

export async function trajetoDoDia(args: {
  organizationId: string;
  gestor: ContextoVendedor;
  memberId: string;
  dia: Date;
}) {
  exigirMembroNoEscopo(args.gestor, args.memberId);
  const inicio = new Date(args.dia);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  const pontos = await prisma.localizacaoVendedor.findMany({
    where: {
      organizationId: args.organizationId,
      memberId: args.memberId,
      capturadoEm: { gte: inicio, lt: fim },
    },
    orderBy: { capturadoEm: "asc" },
    take: 2000,
    select: {
      latitude: true,
      longitude: true,
      capturadoEm: true,
      origem: true,
    },
  });
  return pontos.map((ponto) => ({
    latitude: ponto.latitude,
    longitude: ponto.longitude,
    em: ponto.capturadoEm.toISOString(),
    origem: ponto.origem,
  }));
}

// ── Configuração e condições de pagamento ───────────────────────────────────

export async function salvarConfiguracao(args: {
  organizationId: string;
  descontoLivrePercent: number;
  descontoMaximoPercent: number;
  flexCreditoPercent: number;
  flexLimiteNegativo: number;
  autoAprovar: boolean;
  bloquearInadimplente: boolean;
  raioCheckinMetros: number;
  retencaoLocalizacaoDias: number;
  destinoPedido: DestinoPedido;
}) {
  const { organizationId, ...dados } = args;
  await obterConfiguracao(organizationId);
  await prisma.configuracaoForcaVendas.update({
    where: { organizationId },
    data: dados,
  });
}

export async function listarCondicoes(
  organizationId: string,
  apenasAtivas: boolean,
) {
  const condicoes = await prisma.condicaoPagamento.findMany({
    where: { organizationId, ...(apenasAtivas ? { ativo: true } : {}) },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      prazosDias: true,
      formaPagamento: true,
      ativo: true,
    },
  });
  return condicoes;
}

export async function salvarCondicao(args: {
  organizationId: string;
  id?: string | null;
  nome: string;
  prazosDias: number[];
  formaPagamento: PaymentMethod;
  ativo: boolean;
}) {
  const prazos = [...args.prazosDias].sort((a, b) => a - b);
  const dados = {
    nome: args.nome.trim(),
    prazosDias: prazos.length > 0 ? prazos : [0],
    formaPagamento: args.formaPagamento,
    ativo: args.ativo,
  };
  if (args.id) {
    const { count } = await prisma.condicaoPagamento.updateMany({
      where: { id: args.id, organizationId: args.organizationId },
      data: dados,
    });
    if (count === 0) naoEncontrado("Condição de pagamento não encontrada");
    return { id: args.id };
  }
  return prisma.condicaoPagamento.create({
    data: { organizationId: args.organizationId, ...dados },
    select: { id: true },
  });
}
