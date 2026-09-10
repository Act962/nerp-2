import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { resolveCalendarActor } from "@/app/router/calendar/_access";
import prisma from "@/lib/db";
import { executarAcao } from "../acoes/registro";
import type { ContextoToolsApp } from "./_contexto";

/**
 * Criar ação no calendário. Sem custo em ★: é escrita barata e sem efeito
 * fora do sistema — o que ela precisa é da mesma permissão da tela
 * (`canManage`) e da aprovação na conversa.
 */
export function construirToolsDeAcaoDeCalendario(
  ctx: ContextoToolsApp,
): ToolSet {
  const { organizationId, userId } = ctx;

  return {
    criarEventoNoCalendario: tool({
      description:
        "Cria uma ação no calendário (ação de PDV, campanha, visita, treinamento, reunião). Precisa de aprovação na conversa.",
      inputSchema: z.object({
        titulo: z.string().min(1).max(120),
        inicio: z
          .string()
          .describe("Data e hora de início em ISO 8601, no fuso da loja."),
        fim: z.string().optional().describe("ISO 8601; sem isso, duas horas."),
        tipo: z
          .enum([
            "ACAO_PDV",
            "CAMPANHA",
            "VISITA",
            "TREINAMENTO",
            "REUNIAO",
            "LANCAMENTO",
            "OUTRO",
          ])
          .default("ACAO_PDV"),
        descricao: z.string().max(500).optional(),
        diaInteiro: z.boolean().default(false),
      }),
      execute: async (entrada) =>
        executarAcao(ctx, "criarEventoNoCalendario", entrada, async () => {
          const actor = await resolveCalendarActor(organizationId, userId);
          if (!actor?.canManage) {
            throw new Error(
              "Você não tem permissão para criar eventos no calendário.",
            );
          }

          const startsAt = new Date(entrada.inicio);
          if (Number.isNaN(startsAt.getTime())) {
            throw new Error(`Não entendi a data "${entrada.inicio}".`);
          }
          const endsAt = entrada.fim
            ? new Date(entrada.fim)
            : new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
          if (Number.isNaN(endsAt.getTime()) || endsAt < startsAt) {
            throw new Error("O fim do evento não pode ser antes do início.");
          }

          const evento = await prisma.calendarEvent.create({
            data: {
              organizationId,
              title: entrada.titulo,
              description: entrada.descricao ?? null,
              type: entrada.tipo,
              startsAt,
              endsAt,
              isAllDay: entrada.diaInteiro,
              createdById: actor.memberId,
            },
            select: { id: true, title: true, startsAt: true },
          });

          return {
            evento: {
              titulo: evento.title,
              comeca: evento.startsAt.toISOString(),
            },
            link: { rotulo: "Ver no calendário", href: "/trade/calendario" },
          };
        }),
    }),
  };
}
