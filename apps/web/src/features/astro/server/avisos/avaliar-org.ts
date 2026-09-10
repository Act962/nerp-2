import "server-only";

import {
  buildCalendarWhere,
  resolveCalendarActor,
} from "@/app/router/calendar/_access";
import { limiteDeStars } from "@/features/billing/lib/planos";
import { planoDaOrganizacao } from "@/features/billing/server/plano-da-organizacao";
import { DIAS_PARA_APAGAR } from "@/features/onboarding/server/expirar-sandbox";
import { calcularUso } from "@/features/stars/lib/uso";
import prisma from "@/lib/db";
import { intervaloDoPeriodo } from "../periodo";
import { calcularTicketUsual } from "../ticket-usual";
import { serieDiaria } from "../tools/vendas";
import type { CandidatoAAviso } from "./tipos";

/**
 * O que o Astro tem a dizer sem ninguém perguntar.
 *
 * **Zero IA.** São seis consultas ao banco e um punhado de comparações — o
 * mesmo material das tools de leitura da Fase 2, avaliado por um cron. Pagar
 * um modelo três vezes por dia por organização para descobrir que um produto
 * está abaixo do mínimo seria caro e pior: o SQL não erra a contagem.
 *
 * Nada aqui grava. A gravação é de `gravarAvisos`, para o motor poder ser
 * testado com uma data injetada e sem efeito nenhum.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

/** Quantos produtos abaixo do mínimo já é "alta", e não só "atenção". */
const ESTOQUE_CRITICO = 5;

/** A janela do aviso de calendário: o que acontece amanhã. */
const HORAS_DO_EVENTO = 24;

/** Contratos que vencem dentro deste prazo entram no aviso. */
const DIAS_DO_CONTRATO = 30;

/** O dia, no formato da `dedupeKey`. */
function dia(agora: Date): string {
  return agora.toISOString().slice(0, 10);
}

export async function avaliarAvisosDaOrg(
  organizationId: string,
  agora = new Date(),
): Promise<CandidatoAAviso[]> {
  const candidatos = await Promise.all([
    avisoDeEstoque(organizationId, agora),
    avisoDeTicket(organizationId, agora),
    avisoDeEventos(organizationId, agora),
    avisoDeContratos(organizationId, agora),
    avisoDeStars(organizationId, agora),
    avisoDeSandbox(organizationId, agora),
  ]);

  return candidatos.filter((c): c is CandidatoAAviso => c !== null);
}

async function avisoDeEstoque(
  organizationId: string,
  agora: Date,
): Promise<CandidatoAAviso | null> {
  // A MESMA regra dos widgets do dashboard e da tool `estoqueBaixo`. Uma
  // terceira definição de "estoque baixo" seria um terceiro número.
  const abaixo = await prisma.product.findMany({
    where: {
      organizationId,
      isActive: true,
      trackStock: true,
      currentStock: { lte: prisma.product.fields.minStock },
    },
    orderBy: { currentStock: "asc" },
    take: 5,
    select: { name: true, currentStock: true, minStock: true },
  });
  if (abaixo.length === 0) return null;

  const total = await prisma.product.count({
    where: {
      organizationId,
      isActive: true,
      trackStock: true,
      currentStock: { lte: prisma.product.fields.minStock },
    },
  });

  const nomes = abaixo.map((produto) => produto.name).join(", ");
  return {
    tipo: "estoque_baixo",
    severidade: total >= ESTOQUE_CRITICO ? "alta" : "media",
    titulo:
      total === 1
        ? "1 produto abaixo do estoque mínimo"
        : `${total} produtos abaixo do estoque mínimo`,
    corpo: `Os mais críticos: ${nomes}. Vale conferir a reposição antes de faltar na gôndola.`,
    dados: { total, produtos: abaixo.map((p) => p.name) },
    dedupeKey: `estoque_baixo:${total}:${dia(agora)}`,
  };
}

async function avisoDeTicket(
  organizationId: string,
  agora: Date,
): Promise<CandidatoAAviso | null> {
  const trintaDias = intervaloDoPeriodo("30d", agora);
  const base = {
    from: new Date(trintaDias.from.getTime() - 60 * DIA_MS),
    to: trintaDias.to,
  };

  const historico = await serieDiaria(organizationId, base, "dia");
  const tickets = historico
    .filter((ponto) => ponto.vendas > 0)
    .map((ponto) => ponto.total / ponto.vendas);

  const usual = calcularTicketUsual(tickets);
  if (!usual) return null;

  // Só o dia mais recente com venda interessa: um aviso é sobre agora, não
  // sobre o mês inteiro — para o mês inteiro existe a tool.
  const ultimo = [...historico]
    .filter((ponto) => ponto.vendas > 0)
    .sort((a, b) => b.data.getTime() - a.data.getTime())[0];
  if (!ultimo) return null;

  const ticketDoDia = ultimo.total / ultimo.vendas;
  if (ticketDoDia >= usual.corte) return null;

  const data = ultimo.data.toISOString().slice(0, 10);
  return {
    tipo: "ticket_abaixo",
    severidade: "media",
    titulo: "Ticket médio abaixo do usual",
    corpo: `Em ${data} o ticket médio foi de R$ ${ticketDoDia.toFixed(2)}, contra os R$ ${usual.media.toFixed(2)} usuais desta loja.`,
    dados: {
      data,
      ticket: Number(ticketDoDia.toFixed(2)),
      usual: Number(usual.media.toFixed(2)),
      corte: Number(usual.corte.toFixed(2)),
    },
    dedupeKey: `ticket_abaixo:${data}:${dia(agora)}`,
  };
}

async function avisoDeEventos(
  organizationId: string,
  agora: Date,
): Promise<CandidatoAAviso | null> {
  // O ator é o DONO da organização: o aviso é da empresa, não de uma pessoa,
  // e `buildCalendarWhere` continua sendo quem decide a audiência — montar o
  // filtro à mão aqui vazaria evento de loja que o ator não alcança.
  const dono = await prisma.member.findFirst({
    where: { organizationId, role: "owner" },
    select: { userId: true },
  });
  if (!dono) return null;

  const actor = await resolveCalendarActor(organizationId, dono.userId);
  if (!actor) return null;

  const ate = new Date(agora.getTime() + HORAS_DO_EVENTO * 60 * 60 * 1000);
  const where = await buildCalendarWhere({
    organizationId,
    actor,
    from: agora,
    to: ate,
  });

  const eventos = await prisma.calendarEvent.findMany({
    where,
    orderBy: { startsAt: "asc" },
    take: 3,
    select: { id: true, title: true, startsAt: true, type: true },
  });
  if (eventos.length === 0) return null;

  const primeiro = eventos[0];
  return {
    tipo: "evento_proximo",
    severidade: "media",
    titulo:
      eventos.length === 1
        ? `Amanhã: ${primeiro.title}`
        : `${eventos.length} ações nas próximas 24 horas`,
    corpo: `A primeira é "${primeiro.title}", em ${primeiro.startsAt.toISOString()}. Confira o checklist antes de a equipe sair.`,
    dados: { eventos: eventos.map((evento) => evento.title) },
    dedupeKey: `evento_proximo:${primeiro.id}:${dia(agora)}`,
  };
}

async function avisoDeContratos(
  organizationId: string,
  agora: Date,
): Promise<CandidatoAAviso | null> {
  const ate = new Date(agora.getTime() + DIAS_DO_CONTRATO * DIA_MS);
  const contratos = await prisma.spaceNegotiation.findMany({
    where: {
      organizationId,
      status: "FECHADA",
      endDate: { gte: agora, lte: ate },
    },
    orderBy: { endDate: "asc" },
    take: 5,
    select: { id: true, endDate: true, supplier: { select: { name: true } } },
  });
  if (contratos.length === 0) return null;

  const primeiro = contratos[0];
  const vence = primeiro.endDate?.toISOString().slice(0, 10) ?? "";
  return {
    tipo: "contrato_vencendo",
    severidade: "baixa",
    titulo:
      contratos.length === 1
        ? "1 negociação de espaço vencendo"
        : `${contratos.length} negociações de espaço vencendo`,
    corpo: `A mais próxima é com ${primeiro.supplier?.name ?? "a indústria"}, em ${vence}. Renovar antes do vencimento evita o espaço voltar para a fila.`,
    dados: { total: contratos.length, primeiroVencimento: vence },
    dedupeKey: `contrato_vencendo:${primeiro.id}:${dia(agora)}`,
  };
}

async function avisoDeStars(
  organizationId: string,
  agora: Date,
): Promise<CandidatoAAviso | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { starsBalance: true, starsUsedInCycle: true },
  });
  if (!org) return null;

  const { plano } = await planoDaOrganizacao(organizationId);
  const uso = calcularUso({
    saldo: org.starsBalance,
    limite: limiteDeStars(plano),
    consumido: org.starsUsedInCycle,
  });

  if (uso.nivel !== "critico" && uso.nivel !== "esgotado") return null;

  return {
    tipo: "stars_baixas",
    severidade: uso.nivel === "esgotado" ? "alta" : "media",
    titulo:
      uso.nivel === "esgotado"
        ? "Suas Stars acabaram"
        : `Restam ${uso.saldo} ★`,
    corpo:
      uso.nivel === "esgotado"
        ? "Sem saldo eu não consigo responder nem executar ação nenhuma. Dá para comprar em Configurações › Stars."
        : "O saldo está no fim. Comprar antes de acabar evita a conversa parar no meio.",
    dados: { saldo: uso.saldo, limite: uso.limite, nivel: uso.nivel },
    dedupeKey: `stars_baixas:${uso.nivel}:${dia(agora)}`,
  };
}

async function avisoDeSandbox(
  organizationId: string,
  agora: Date,
): Promise<CandidatoAAviso | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { verifiedAt: true, expiryWarnedAt: true, lastAccessAt: true },
  });
  if (!org || org.verifiedAt || !org.expiryWarnedAt) return null;

  const referencia = org.lastAccessAt ?? org.expiryWarnedAt;
  const diasParados = Math.floor(
    (agora.getTime() - referencia.getTime()) / DIA_MS,
  );
  const faltam = Math.max(0, DIAS_PARA_APAGAR - diasParados);

  return {
    tipo: "sandbox_expira",
    severidade: faltam <= 3 ? "alta" : "media",
    titulo:
      faltam === 0
        ? "Sua empresa de teste expira hoje"
        : `Sua empresa de teste expira em ${faltam} dia${faltam === 1 ? "" : "s"}`,
    corpo:
      "Criar a conta com o Google mantém tudo o que você montou aqui: produtos, clientes, catálogos e o histórico.",
    dados: { faltam },
    dedupeKey: `sandbox_expira:${faltam}:${dia(agora)}`,
  };
}
