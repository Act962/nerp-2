import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { MeetingType } from "@/generated/prisma/enums";
import { acharClientePeloTelefone } from "@/features/crm/server/casar-cliente";
import prisma from "@/lib/db";
import {
  diaDaSemanaDaData,
  type Faixa,
  gerarEncaixes,
  paredeParaUtc,
} from "../lib/horarios";

/** O horário pedido não existe na grade, ou o dia está bloqueado. */
export class HorarioIndisponivelError extends Error {
  constructor(mensagem = "Esse horário não está disponível nesta agenda") {
    super(mensagem);
    this.name = "HorarioIndisponivelError";
  }
}

/** Alguém marcou primeiro. */
export class HorarioOcupadoError extends Error {
  constructor(mensagem = "Esse horário acabou de ser preenchido") {
    super(mensagem);
    this.name = "HorarioOcupadoError";
  }
}

/**
 * Faixas de atendimento de um dia.
 *
 * Disponibilidade cadastrada para a **data** vence a grade semanal por inteiro
 * — é assim que "nesse sábado atendo só de manhã" funciona sem mexer no
 * sábado das outras semanas. Data bloqueada zera o dia, mesmo que a grade
 * semanal diga o contrário.
 */
export async function faixasDoDia(
  agendaId: string,
  data: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<Faixa[]> {
  const bloqueio = await tx.agendaDateOverride.findUnique({
    where: { agendaId_date: { agendaId, date: data } },
    select: { isBlocked: true },
  });
  if (bloqueio?.isBlocked) return [];

  const doDia = await tx.agendaDateAvailability.findUnique({
    where: { agendaId_date: { agendaId, date: data } },
    select: {
      timeSlots: {
        orderBy: { order: "asc" },
        select: { startTime: true, endTime: true },
      },
    },
  });
  if (doDia) return doDia.timeSlots;

  return tx.availabilityTimeSlot.findMany({
    where: {
      availability: {
        agendaId,
        dayOfWeek: diaDaSemanaDaData(data),
        isActive: true,
      },
    },
    orderBy: { order: "asc" },
    select: { startTime: true, endTime: true },
  });
}

type DadosDoAgendamento = {
  organizationId: string;
  agendaId: string;
  /** "YYYY-MM-DD" na parede da loja. */
  data: string;
  /** "HH:MM" — precisa bater com um encaixe gerado pela grade. */
  hora: string;
  nome: string;
  /** E.164. É a chave do lead no funil e o casamento com o cliente do ERP. */
  telefone: string;
  email?: string | null;
  observacao?: string | null;
  meetingType?: MeetingType;
  /** Atendente responsável, quando quem marca é a loja. */
  userId?: string | null;
};

export type Agendamento = {
  appointmentId: string;
  leadId: string;
  startsAt: Date;
  endsAt: Date;
};

/**
 * Marca um compromisso, criando o lead se o telefone ainda não estiver no
 * funil.
 *
 * Roda em transação **serializável** de propósito. O caminho é ler os
 * compromissos do dia, concluir que o horário está livre e inserir — dois
 * cliques simultâneos no mesmo encaixe leriam os dois "livre" e marcariam os
 * dois. Serializável faz o segundo falhar em vez de aceitar, e o erro vira
 * "esse horário acabou de ser preenchido", que é a verdade.
 *
 * O mesmo caminho serve a página pública e o atendente marcando pelo ERP: uma
 * regra só, senão a tela interna vira a porta dos fundos que ignora bloqueio de
 * data e grade de horário.
 */
export async function agendarCompromisso(
  dados: DadosDoAgendamento,
): Promise<Agendamento> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const agenda = await tx.agenda.findFirst({
          where: {
            id: dados.agendaId,
            organizationId: dados.organizationId,
            isActive: true,
          },
          select: {
            id: true,
            funnelId: true,
            stageId: true,
            slotDuration: true,
            name: true,
          },
        });
        if (!agenda) {
          throw new HorarioIndisponivelError(
            "Agenda não encontrada ou inativa",
          );
        }

        const faixas = await faixasDoDia(agenda.id, dados.data, tx);
        if (faixas.length === 0) throw new HorarioIndisponivelError();

        const inicioDoDia = paredeParaUtc(dados.data, 0);
        const ocupados = await tx.appointment.findMany({
          where: {
            agendaId: agenda.id,
            status: { not: "CANCELLED" },
            startsAt: {
              gte: inicioDoDia,
              lt: new Date(inicioDoDia.getTime() + 86_400_000),
            },
          },
          select: { startsAt: true, endsAt: true },
        });

        const encaixe = gerarEncaixes({
          data: dados.data,
          duracaoMin: agenda.slotDuration,
          faixas,
          ocupados,
        }).find((candidato) => candidato.inicio === dados.hora);

        if (!encaixe) throw new HorarioIndisponivelError();
        if (encaixe.passado) {
          throw new HorarioIndisponivelError("Esse horário já passou");
        }
        if (encaixe.ocupado) throw new HorarioOcupadoError();

        const leadId = await acharOuCriarLead(tx, dados, agenda);

        const compromisso = await tx.appointment.create({
          data: {
            organizationId: dados.organizationId,
            agendaId: agenda.id,
            leadId,
            userId: dados.userId ?? null,
            title: `${agenda.name} — ${dados.nome}`,
            notes: dados.observacao || null,
            startsAt: encaixe.instante,
            endsAt: new Date(
              encaixe.instante.getTime() + agenda.slotDuration * 60_000,
            ),
            meetingType: dados.meetingType ?? "ONLINE",
          },
          select: { id: true, startsAt: true, endsAt: true },
        });

        return {
          appointmentId: compromisso.id,
          leadId,
          startsAt: compromisso.startsAt,
          endsAt: compromisso.endsAt,
        };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (erro) {
    // P2034: a transação foi abortada por conflito de escrita. Aqui isso só
    // acontece quando dois agendamentos disputaram o mesmo encaixe.
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2034"
    ) {
      throw new HorarioOcupadoError();
    }
    throw erro;
  }
}

async function acharOuCriarLead(
  tx: Prisma.TransactionClient,
  dados: DadosDoAgendamento,
  agenda: { funnelId: string; stageId: string | null },
): Promise<string> {
  const existente = await tx.crmLead.findUnique({
    where: {
      phone_funnelId: { phone: dados.telefone, funnelId: agenda.funnelId },
    },
    select: { id: true },
  });

  if (existente) {
    // Não sobrescreve nome nem e-mail: o atendente pode ter corrigido a ficha,
    // e o formulário público não é fonte mais confiável que ele. O que muda é
    // a etapa, porque agendar é o avanço no funil que a agenda promete.
    if (agenda.stageId) {
      await tx.crmLead.update({
        where: { id: existente.id },
        data: { stageId: agenda.stageId, stageEnteredAt: new Date() },
      });
    }
    return existente.id;
  }

  const estagio =
    agenda.stageId ??
    (
      await tx.crmStage.findFirst({
        where: { funnelId: agenda.funnelId },
        orderBy: { order: "asc" },
        select: { id: true },
      })
    )?.id;

  if (!estagio) {
    throw new HorarioIndisponivelError(
      "O funil desta agenda não tem etapas configuradas",
    );
  }

  const customerId = await acharClientePeloTelefone(
    dados.telefone,
    dados.organizationId,
  );

  const lead = await tx.crmLead.create({
    data: {
      organizationId: dados.organizationId,
      funnelId: agenda.funnelId,
      stageId: estagio,
      customerId,
      name: dados.nome,
      phone: dados.telefone,
      email: dados.email || null,
      source: "AGENDA",
      stageEnteredAt: new Date(),
    },
    select: { id: true },
  });

  return lead.id;
}
