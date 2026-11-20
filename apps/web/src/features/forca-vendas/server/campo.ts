import "server-only";

import { ORPCError } from "@orpc/server";
import type { ResultadoVisita } from "@/generated/prisma/enums";
import { optimizeRoute } from "@/app/router/promoter-route/_optimize";
import prisma from "@/lib/db";
import { distanceMeters } from "@/lib/geo-distance";
import { garantirPerfil, obterConfiguracao } from "./configuracao";
import { type ContextoVendedor, clienteVisivel } from "./escopo-equipe";

function naoEncontrado(message: string): never {
  throw new ORPCError("NOT_FOUND", { message });
}

function invalido(message: string): never {
  throw new ORPCError("BAD_REQUEST", { message });
}

function inicioDoDia(data = new Date()): Date {
  const dia = new Date(data);
  dia.setHours(0, 0, 0, 0);
  return dia;
}

// ── Roteiro ──────────────────────────────────────────────────────────────────

/** A agenda de um dia da semana, com a visita de hoje de cada cliente. */
export async function roteiroDoDia(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  diaSemana: number;
}) {
  const paradas = await prisma.roteiroVisita.findMany({
    where: {
      organizationId: args.organizationId,
      memberId: args.vendedor.memberId,
      diaSemana: args.diaSemana,
    },
    orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      ordem: true,
      customer: {
        select: {
          id: true,
          name: true,
          tradeName: true,
          address: true,
          addressNumber: true,
          neighborhood: true,
          city: true,
          phone: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  });
  const visitas = await prisma.visitaCliente.findMany({
    where: {
      organizationId: args.organizationId,
      memberId: args.vendedor.memberId,
      checkinEm: { gte: inicioDoDia() },
    },
    orderBy: { checkinEm: "desc" },
    select: {
      id: true,
      customerId: true,
      checkinEm: true,
      checkoutEm: true,
      resultado: true,
      foraDoRaio: true,
    },
  });
  const visitaPorCliente = new Map<string, (typeof visitas)[number]>();
  for (const visita of visitas) {
    if (!visitaPorCliente.has(visita.customerId)) {
      visitaPorCliente.set(visita.customerId, visita);
    }
  }

  return paradas.map((parada) => {
    const cliente = parada.customer;
    const visita = visitaPorCliente.get(cliente.id);
    return {
      roteiroId: parada.id,
      ordem: parada.ordem,
      cliente: {
        id: cliente.id,
        nome: cliente.tradeName || cliente.name,
        endereco:
          [
            [cliente.address, cliente.addressNumber].filter(Boolean).join(", "),
            cliente.neighborhood,
            cliente.city,
          ]
            .filter(Boolean)
            .join(" · ") || null,
        telefone: cliente.phone,
        localizacao:
          cliente.latitude !== null && cliente.longitude !== null
            ? { latitude: cliente.latitude, longitude: cliente.longitude }
            : null,
      },
      visita: visita
        ? {
            id: visita.id,
            checkinEm: visita.checkinEm.toISOString(),
            checkoutEm: visita.checkoutEm?.toISOString() ?? null,
            resultado: visita.resultado,
            foraDoRaio: visita.foraDoRaio,
          }
        : null,
    };
  });
}

export async function adicionarAoRoteiro(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  customerId: string;
  diaSemana: number;
}) {
  if (
    !(await clienteVisivel(
      args.organizationId,
      args.vendedor.escopo,
      args.customerId,
    ))
  ) {
    naoEncontrado("Cliente não encontrado na sua carteira");
  }
  const ultimo = await prisma.roteiroVisita.aggregate({
    where: { memberId: args.vendedor.memberId, diaSemana: args.diaSemana },
    _max: { ordem: true },
  });
  await prisma.roteiroVisita.upsert({
    where: {
      memberId_customerId_diaSemana: {
        memberId: args.vendedor.memberId,
        customerId: args.customerId,
        diaSemana: args.diaSemana,
      },
    },
    create: {
      organizationId: args.organizationId,
      memberId: args.vendedor.memberId,
      customerId: args.customerId,
      diaSemana: args.diaSemana,
      ordem: (ultimo._max.ordem ?? -1) + 1,
    },
    update: {},
  });
}

export async function removerDoRoteiro(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  roteiroId: string;
}) {
  await prisma.roteiroVisita.deleteMany({
    where: {
      id: args.roteiroId,
      organizationId: args.organizationId,
      memberId: args.vendedor.memberId,
    },
  });
}

export async function reordenarRoteiro(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  roteiroIds: string[];
}) {
  const paradas = await prisma.roteiroVisita.findMany({
    where: {
      id: { in: args.roteiroIds },
      organizationId: args.organizationId,
      memberId: args.vendedor.memberId,
    },
    select: { id: true },
  });
  if (paradas.length !== args.roteiroIds.length)
    invalido("Roteiro desatualizado. Abra de novo.");
  await prisma.$transaction(
    args.roteiroIds.map((id, ordem) =>
      prisma.roteiroVisita.update({ where: { id }, data: { ordem } }),
    ),
  );
}

/**
 * Ordena as paradas do dia pelo menor caminho (o mesmo 2-opt da rota do
 * promotor). Cliente sem localização vai para o fim, na ordem em que estava.
 */
export async function otimizarRoteiro(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  diaSemana: number;
  origem?: { latitude: number; longitude: number } | null;
}) {
  const paradas = await roteiroDoDia(args);
  const comPonto = paradas.flatMap((parada) =>
    parada.cliente.localizacao
      ? [{ id: parada.roteiroId, ...parada.cliente.localizacao }]
      : [],
  );
  const semPonto = paradas.filter((parada) => !parada.cliente.localizacao);
  const resultado = optimizeRoute(comPonto, args.origem ?? undefined);
  await reordenarRoteiro({
    organizationId: args.organizationId,
    vendedor: args.vendedor,
    roteiroIds: [
      ...resultado.order.map((ponto) => ponto.id),
      ...semPonto.map((parada) => parada.roteiroId),
    ],
  });
  return {
    antesMetros: Math.round(resultado.beforeMeters),
    depoisMetros: Math.round(resultado.afterMeters),
    semLocalizacao: semPonto.length,
  };
}

// ── Localização e jornada ───────────────────────────────────────────────────

type Ponto = {
  capturadoEm: string;
  latitude: number;
  longitude: number;
  precisaoM?: number | null;
  bateria?: number | null;
};

async function jornadaAberta(organizationId: string, memberId: string) {
  return prisma.jornadaVendedor.findFirst({
    where: { organizationId, memberId, encerradaEm: null },
    orderBy: { iniciadaEm: "desc" },
    select: { id: true, iniciadaEm: true },
  });
}

/**
 * Grava pontos de localização e atualiza a última posição do vendedor.
 * `PING` só é aceito com jornada aberta — fora dela o módulo não rastreia.
 * Check-in, check-out e pedido gravam o ponto da ação mesmo sem jornada.
 */
export async function registrarPontos(args: {
  organizationId: string;
  memberId: string;
  origem: "PING" | "CHECKIN" | "CHECKOUT" | "PEDIDO";
  pontos: Ponto[];
}): Promise<{ gravados: number }> {
  if (args.pontos.length === 0) return { gravados: 0 };
  const jornada = await jornadaAberta(args.organizationId, args.memberId);
  if (args.origem === "PING" && !jornada) {
    invalido("Inicie a jornada para registrar a localização");
  }

  const pontos = args.pontos
    .map((ponto) => ({ ...ponto, data: new Date(ponto.capturadoEm) }))
    .filter((ponto) => !Number.isNaN(ponto.data.getTime()))
    .sort((a, b) => a.data.getTime() - b.data.getTime());
  if (pontos.length === 0) return { gravados: 0 };

  const { count } = await prisma.localizacaoVendedor.createMany({
    data: pontos.map((ponto) => ({
      organizationId: args.organizationId,
      memberId: args.memberId,
      jornadaId: jornada?.id ?? null,
      capturadoEm: ponto.data,
      latitude: ponto.latitude,
      longitude: ponto.longitude,
      precisaoM: ponto.precisaoM ?? null,
      bateria: ponto.bateria ?? null,
      origem: args.origem,
    })),
    skipDuplicates: true,
  });

  const ultimo = pontos[pontos.length - 1];
  const perfil = await garantirPerfil(args.organizationId, args.memberId);
  if (!perfil.ultimaPosicaoEm || perfil.ultimaPosicaoEm < ultimo.data) {
    await prisma.vendedorPerfil.update({
      where: { id: perfil.id },
      data: {
        ultimaLatitude: ultimo.latitude,
        ultimaLongitude: ultimo.longitude,
        ultimaPrecisaoM: ultimo.precisaoM ?? null,
        ultimaBateria: ultimo.bateria ?? perfil.ultimaBateria,
        ultimaPosicaoEm: ultimo.data,
      },
    });
  }
  return { gravados: count };
}

export async function estadoDaJornada(
  organizationId: string,
  memberId: string,
) {
  const jornada = await jornadaAberta(organizationId, memberId);
  return jornada
    ? {
        aberta: true as const,
        id: jornada.id,
        iniciadaEm: jornada.iniciadaEm.toISOString(),
      }
    : { aberta: false as const, id: null, iniciadaEm: null };
}

export async function iniciarJornada(organizationId: string, memberId: string) {
  const aberta = await jornadaAberta(organizationId, memberId);
  if (aberta) return estadoDaJornada(organizationId, memberId);
  await prisma.jornadaVendedor.create({ data: { organizationId, memberId } });
  return estadoDaJornada(organizationId, memberId);
}

export async function encerrarJornada(
  organizationId: string,
  memberId: string,
) {
  await prisma.jornadaVendedor.updateMany({
    where: { organizationId, memberId, encerradaEm: null },
    data: { encerradaEm: new Date() },
  });
  return estadoDaJornada(organizationId, memberId);
}

// ── Visita ───────────────────────────────────────────────────────────────────

export async function visitaAberta(organizationId: string, memberId: string) {
  const visita = await prisma.visitaCliente.findFirst({
    where: {
      organizationId,
      memberId,
      checkoutEm: null,
      checkinEm: { gte: inicioDoDia() },
    },
    orderBy: { checkinEm: "desc" },
    select: {
      id: true,
      checkinEm: true,
      foraDoRaio: true,
      distanciaClienteM: true,
      customer: { select: { id: true, name: true, tradeName: true } },
    },
  });
  if (!visita) return null;
  return {
    id: visita.id,
    checkinEm: visita.checkinEm.toISOString(),
    foraDoRaio: visita.foraDoRaio,
    distanciaClienteM: visita.distanciaClienteM,
    cliente: {
      id: visita.customer.id,
      nome: visita.customer.tradeName || visita.customer.name,
    },
  };
}

/**
 * Check-in no cliente. Cliente sem localização ganha a do check-in (é a
 * primeira visita que o geolocaliza); com localização, a distância decide se
 * a visita foi fora do raio — e aí a justificativa é obrigatória.
 */
export async function fazerCheckin(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  customerId: string;
  clientOperationId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  precisaoM?: number | null;
  justificativa?: string | null;
}) {
  const { organizationId, vendedor } = args;
  if (args.clientOperationId) {
    const existente = await prisma.visitaCliente.findUnique({
      where: { clientOperationId: args.clientOperationId },
      select: { id: true, organizationId: true },
    });
    if (existente?.organizationId === organizationId)
      return { visitaId: existente.id, foraDoRaio: false, distanciaM: null };
  }
  if (
    !(await clienteVisivel(organizationId, vendedor.escopo, args.customerId))
  ) {
    naoEncontrado("Cliente não encontrado na sua carteira");
  }
  const aberta = await visitaAberta(organizationId, vendedor.memberId);
  if (aberta) {
    invalido(
      `Faça o check-out de ${aberta.cliente.nome} antes de visitar outro cliente`,
    );
  }

  const cliente = await prisma.customer.findFirstOrThrow({
    where: { id: args.customerId, organizationId },
    select: { latitude: true, longitude: true },
  });
  const config = await obterConfiguracao(organizationId);
  const temPonto = args.latitude != null && args.longitude != null;

  let distanciaM: number | null = null;
  let foraDoRaio = false;
  if (temPonto && cliente.latitude !== null && cliente.longitude !== null) {
    distanciaM = Math.round(
      distanceMeters(
        {
          latitude: args.latitude as number,
          longitude: args.longitude as number,
        },
        { latitude: cliente.latitude, longitude: cliente.longitude },
      ),
    );
    foraDoRaio = distanciaM > config.raioCheckinMetros;
  }
  // Sem GPS não dá para provar onde a visita aconteceu: conta como fora do raio.
  if (!temPonto) foraDoRaio = true;
  if (foraDoRaio && !args.justificativa?.trim()) {
    invalido(
      distanciaM !== null
        ? `Você está a ${distanciaM} m do cliente. Explique por que o check-in é fora do local.`
        : "Sem localização do aparelho. Explique por que o check-in é feito assim.",
    );
  }

  const agora = new Date();
  const visita = await prisma.visitaCliente.create({
    data: {
      organizationId,
      memberId: vendedor.memberId,
      customerId: args.customerId,
      clientOperationId: args.clientOperationId ?? null,
      checkinEm: agora,
      checkinLatitude: args.latitude ?? null,
      checkinLongitude: args.longitude ?? null,
      checkinPrecisaoM: args.precisaoM ?? null,
      distanciaClienteM: distanciaM,
      foraDoRaio,
      justificativa: args.justificativa?.trim() || null,
    },
    select: { id: true },
  });

  if (temPonto) {
    if (cliente.latitude === null) {
      await prisma.customer.update({
        where: { id: args.customerId },
        data: { latitude: args.latitude, longitude: args.longitude },
      });
    }
    await registrarPontos({
      organizationId,
      memberId: vendedor.memberId,
      origem: "CHECKIN",
      pontos: [
        {
          capturadoEm: agora.toISOString(),
          latitude: args.latitude as number,
          longitude: args.longitude as number,
          precisaoM: args.precisaoM,
        },
      ],
    });
  }

  return { visitaId: visita.id, foraDoRaio, distanciaM };
}

export async function fazerCheckout(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  visitaId: string;
  resultado: ResultadoVisita;
  motivoSemPedido?: string | null;
  observacao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const visita = await prisma.visitaCliente.findFirst({
    where: {
      id: args.visitaId,
      organizationId: args.organizationId,
      memberId: args.vendedor.memberId,
    },
    select: { id: true, checkoutEm: true },
  });
  if (!visita) naoEncontrado("Visita não encontrada");
  if (visita.checkoutEm) invalido("Esta visita já foi encerrada");
  if (args.resultado === "SEM_PEDIDO" && !args.motivoSemPedido?.trim()) {
    invalido("Diga por que o cliente não comprou");
  }

  const agora = new Date();
  await prisma.visitaCliente.update({
    where: { id: visita.id },
    data: {
      checkoutEm: agora,
      checkoutLatitude: args.latitude ?? null,
      checkoutLongitude: args.longitude ?? null,
      resultado: args.resultado,
      motivoSemPedido: args.motivoSemPedido?.trim() || null,
      observacao: args.observacao?.trim() || null,
    },
  });
  if (args.latitude != null && args.longitude != null) {
    await registrarPontos({
      organizationId: args.organizationId,
      memberId: args.vendedor.memberId,
      origem: "CHECKOUT",
      pontos: [
        {
          capturadoEm: agora.toISOString(),
          latitude: args.latitude,
          longitude: args.longitude,
        },
      ],
    });
  }
}

/** Planejado × visitado × positivado de um dia, por vendedor do escopo. */
export async function resumoDeVisitas(args: {
  organizationId: string;
  memberIds: string[] | null;
  dia: Date;
}) {
  const inicio = inicioDoDia(args.dia);
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  const filtroMembro = args.memberIds ? { in: args.memberIds } : undefined;
  const [planejadas, visitas] = await Promise.all([
    prisma.roteiroVisita.groupBy({
      by: ["memberId"],
      where: {
        organizationId: args.organizationId,
        diaSemana: inicio.getDay(),
        ...(filtroMembro ? { memberId: filtroMembro } : {}),
      },
      _count: true,
    }),
    prisma.visitaCliente.findMany({
      where: {
        organizationId: args.organizationId,
        checkinEm: { gte: inicio, lt: fim },
        ...(filtroMembro ? { memberId: filtroMembro } : {}),
      },
      orderBy: { checkinEm: "asc" },
      select: {
        id: true,
        memberId: true,
        checkinEm: true,
        checkoutEm: true,
        resultado: true,
        foraDoRaio: true,
        distanciaClienteM: true,
        justificativa: true,
        motivoSemPedido: true,
        customer: { select: { name: true, tradeName: true } },
      },
    }),
  ]);
  return {
    planejadas: planejadas.map((linha) => ({
      memberId: linha.memberId,
      quantidade: linha._count,
    })),
    visitas: visitas.map((visita) => ({
      id: visita.id,
      memberId: visita.memberId,
      cliente: visita.customer.tradeName || visita.customer.name,
      checkinEm: visita.checkinEm.toISOString(),
      checkoutEm: visita.checkoutEm?.toISOString() ?? null,
      resultado: visita.resultado,
      foraDoRaio: visita.foraDoRaio,
      distanciaClienteM: visita.distanciaClienteM,
      justificativa: visita.justificativa,
      motivoSemPedido: visita.motivoSemPedido,
    })),
  };
}
