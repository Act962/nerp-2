import "server-only";

import { ORPCError } from "@orpc/server";
import type { PrioridadeAviso, PublicoAviso } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { type ContextoVendedor, membroNoEscopo } from "./escopo-equipe";

function vigentes(agora: Date) {
  return { OR: [{ fimEm: null }, { fimEm: { gte: agora } }] };
}

/** Avisos vigentes para o vendedor, os não confirmados primeiro. */
export async function avisosDoVendedor(args: {
  organizationId: string;
  memberId: string;
}) {
  const agora = new Date();
  const avisos = await prisma.avisoGestor.findMany({
    where: {
      organizationId: args.organizationId,
      inicioEm: { lte: agora },
      // Dois OR independentes (vigência e público) dentro de um AND.
      AND: [
        vigentes(agora),
        {
          OR: [
            { publico: "TODOS" },
            { leituras: { some: { memberId: args.memberId } } },
          ],
        },
      ],
    },
    orderBy: { inicioEm: "desc" },
    take: 50,
    select: {
      id: true,
      titulo: true,
      corpo: true,
      link: true,
      prioridade: true,
      exigeConfirmacao: true,
      inicioEm: true,
      fimEm: true,
      autor: { select: { user: { select: { name: true } } } },
      leituras: {
        where: { memberId: args.memberId },
        select: { visualizadoEm: true, confirmadoEm: true },
      },
    },
  });
  return avisos.map((aviso) => {
    const leitura = aviso.leituras[0];
    const pendente = aviso.exigeConfirmacao
      ? !leitura?.confirmadoEm
      : !leitura?.visualizadoEm;
    return {
      id: aviso.id,
      titulo: aviso.titulo,
      corpo: aviso.corpo,
      link: aviso.link,
      prioridade: aviso.prioridade,
      exigeConfirmacao: aviso.exigeConfirmacao,
      inicioEm: aviso.inicioEm.toISOString(),
      fimEm: aviso.fimEm?.toISOString() ?? null,
      autor: aviso.autor?.user.name ?? null,
      visualizadoEm: leitura?.visualizadoEm?.toISOString() ?? null,
      confirmadoEm: leitura?.confirmadoEm?.toISOString() ?? null,
      pendente,
    };
  });
}

export async function marcarAviso(args: {
  organizationId: string;
  memberId: string;
  avisoId: string;
  acao: "VISUALIZAR" | "CONFIRMAR";
}) {
  const agora = new Date();
  const aviso = await prisma.avisoGestor.findFirst({
    where: {
      id: args.avisoId,
      organizationId: args.organizationId,
      OR: [
        { publico: "TODOS" },
        { leituras: { some: { memberId: args.memberId } } },
      ],
    },
    select: { id: true },
  });
  if (!aviso)
    throw new ORPCError("NOT_FOUND", { message: "Aviso não encontrado" });

  // Para TODOS, quem entrou na equipe depois da publicação ganha a linha aqui.
  await prisma.avisoGestorLeitura.upsert({
    where: { avisoId_memberId: { avisoId: aviso.id, memberId: args.memberId } },
    create: {
      organizationId: args.organizationId,
      avisoId: aviso.id,
      memberId: args.memberId,
      visualizadoEm: agora,
      confirmadoEm: args.acao === "CONFIRMAR" ? agora : null,
    },
    update:
      args.acao === "CONFIRMAR"
        ? { confirmadoEm: agora, visualizadoEm: agora }
        : { visualizadoEm: agora },
  });
}

export async function publicarAviso(args: {
  organizationId: string;
  autor: ContextoVendedor;
  titulo: string;
  corpo: string;
  link?: string | null;
  prioridade: PrioridadeAviso;
  exigeConfirmacao: boolean;
  publico: PublicoAviso;
  memberIds: string[];
  fimEm?: string | null;
}) {
  // Congela o público na publicação: "lido por X de Y" não muda sozinho
  // quando alguém entra ou sai da equipe depois.
  // Supervisor fala com a equipe dele: "todos" vira a lista da equipe, senão
  // o aviso apareceria para vendedores de outros supervisores.
  const publico: PublicoAviso =
    args.autor.escopo.tipo === "TODOS" ? args.publico : "MEMBROS";
  const destinatarios =
    args.publico === "TODOS"
      ? await prisma.vendedorPerfil.findMany({
          where: { organizationId: args.organizationId, ativo: true },
          select: { memberId: true },
        })
      : await prisma.member.findMany({
          where: {
            organizationId: args.organizationId,
            id: { in: args.memberIds },
          },
          select: { id: true },
        });
  const memberIds = destinatarios
    .map((linha) => ("memberId" in linha ? linha.memberId : linha.id))
    .filter((memberId) => membroNoEscopo(args.autor.escopo, memberId));
  if (publico === "MEMBROS" && memberIds.length === 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Escolha ao menos um vendedor",
    });
  }

  return prisma.avisoGestor.create({
    data: {
      organizationId: args.organizationId,
      autorId: args.autor.memberId,
      titulo: args.titulo.trim(),
      corpo: args.corpo.trim(),
      link: args.link?.trim() || null,
      prioridade: args.prioridade,
      exigeConfirmacao: args.exigeConfirmacao || args.prioridade === "URGENTE",
      publico,
      fimEm: args.fimEm ? new Date(args.fimEm) : null,
      leituras: {
        createMany: {
          data: memberIds.map((memberId) => ({
            organizationId: args.organizationId,
            memberId,
          })),
          skipDuplicates: true,
        },
      },
    },
    select: { id: true },
  });
}

export async function listarAvisosDoGestor(organizationId: string) {
  const avisos = await prisma.avisoGestor.findMany({
    where: { organizationId },
    orderBy: { inicioEm: "desc" },
    take: 50,
    select: {
      id: true,
      titulo: true,
      corpo: true,
      prioridade: true,
      exigeConfirmacao: true,
      publico: true,
      inicioEm: true,
      fimEm: true,
      autor: { select: { user: { select: { name: true } } } },
      leituras: {
        select: {
          visualizadoEm: true,
          confirmadoEm: true,
          member: { select: { user: { select: { name: true } } } },
        },
      },
    },
  });
  const agora = new Date();
  return avisos.map((aviso) => {
    const lidos = aviso.leituras.filter((leitura) =>
      aviso.exigeConfirmacao ? leitura.confirmadoEm : leitura.visualizadoEm,
    );
    return {
      id: aviso.id,
      titulo: aviso.titulo,
      corpo: aviso.corpo,
      prioridade: aviso.prioridade,
      exigeConfirmacao: aviso.exigeConfirmacao,
      publico: aviso.publico,
      inicioEm: aviso.inicioEm.toISOString(),
      fimEm: aviso.fimEm?.toISOString() ?? null,
      vigente: !aviso.fimEm || aviso.fimEm >= agora,
      autor: aviso.autor?.user.name ?? null,
      total: aviso.leituras.length,
      lidos: lidos.length,
      pendentes: aviso.leituras
        .filter((leitura) => !lidos.includes(leitura))
        .map((leitura) => leitura.member.user.name),
    };
  });
}

export async function encerrarAviso(organizationId: string, avisoId: string) {
  const { count } = await prisma.avisoGestor.updateMany({
    where: { id: avisoId, organizationId },
    data: { fimEm: new Date() },
  });
  if (count === 0)
    throw new ORPCError("NOT_FOUND", { message: "Aviso não encontrado" });
}
