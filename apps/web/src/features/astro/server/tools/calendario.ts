import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import {
  buildCalendarWhere,
  resolveCalendarActor,
} from "@/app/router/calendar/_access";
import prisma from "@/lib/db";
import type { ContextoToolsApp } from "./_contexto";

/**
 * Calendário: o que vem pela frente.
 *
 * A audiência passa OBRIGATORIAMENTE por `buildCalendarWhere` — a mesma
 * função que as telas usam. Montar o filtro à mão aqui faria o Astro contar
 * para um promotor os eventos de lojas que não são dele, que é exatamente o
 * que aquele arquivo existe para impedir.
 */
export function construirToolsDeCalendario(ctx: ContextoToolsApp): ToolSet {
  const { organizationId, userId } = ctx;

  return {
    proximosEventos: tool({
      description:
        "As próximas ações do calendário (ações de PDV, campanhas, visitas, reuniões) nos próximos N dias, com o que já está pendente no checklist.",
      inputSchema: z.object({
        dias: z.number().int().min(1).max(60).default(14),
      }),
      execute: async ({ dias }) => {
        const actor = await resolveCalendarActor(organizationId, userId);
        if (!actor) {
          return { erro: "Você não é membro desta organização." };
        }

        const agora = new Date();
        const ate = new Date(agora.getTime() + dias * 86_400_000);
        const where = await buildCalendarWhere({
          organizationId,
          actor,
          from: agora,
          to: ate,
        });

        const eventos = await prisma.calendarEvent.findMany({
          where,
          orderBy: { startsAt: "asc" },
          take: 20,
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            startsAt: true,
            endsAt: true,
            isAllDay: true,
            location: true,
            isDemo: true,
            stores: { select: { store: { select: { name: true } } }, take: 5 },
            suppliers: {
              select: { supplier: { select: { name: true } } },
              take: 5,
            },
            _count: { select: { checklistItems: true } },
          },
        });

        return {
          janela: `próximos ${dias} dias`,
          eventos: eventos.map((evento) => ({
            titulo: evento.title,
            tipo: evento.type,
            situacao: evento.status,
            comeca: evento.startsAt.toISOString(),
            termina: evento.endsAt.toISOString(),
            diaInteiro: evento.isAllDay,
            local: evento.location,
            lojas: evento.stores.map((s) => s.store.name),
            industrias: evento.suppliers.map((s) => s.supplier.name),
            itensDeChecklist: evento._count.checklistItems,
            exemplo: evento.isDemo,
          })),
        };
      },
    }),
  };
}
