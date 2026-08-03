import { z } from "zod";

export const EVENT_TYPES = [
  "ACAO_PDV",
  "CAMPANHA",
  "VISITA",
  "TREINAMENTO",
  "REUNIAO",
  "LANCAMENTO",
  "OUTRO",
] as const;

export const EVENT_STATUSES = [
  "PLANEJADO",
  "EM_ANDAMENTO",
  "CONCLUIDO",
  "CANCELADO",
] as const;

export const EVENT_VISIBILITIES = ["ORG", "LINKED"] as const;

/**
 * Datas trafegam como instante ISO, nunca como "YYYY-MM-DD": o servidor roda em
 * UTC e o usuário está em UTC-3, então quem resolve o dia local é sempre o
 * cliente. Um "2026-08-01" interpretado aqui viraria 21h do dia 31 para ele.
 */
export const eventInputSchema = z.object({
  title: z.string().trim().min(2, "Informe o título do evento").max(140),
  description: z.string().trim().max(2000).nullable().optional(),
  type: z.enum(EVENT_TYPES).default("ACAO_PDV"),
  status: z.enum(EVENT_STATUSES).default("PLANEJADO"),
  visibility: z.enum(EVENT_VISIBILITIES).default("ORG"),
  color: z.string().trim().max(20).nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  isAllDay: z.boolean().default(true),
  location: z.string().trim().max(200).nullable().optional(),
  storeIds: z.array(z.string()).default([]),
  supplierIds: z.array(z.string()).default([]),
  /** Promotores escalados para a ação. */
  memberIds: z.array(z.string()).default([]),
});

export const noteTaskSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Informe o item").max(200),
  isDone: z.boolean().default(false),
});

export const noteInputSchema = z.object({
  title: z.string().trim().min(1, "Informe o título").max(140),
  content: z.string().trim().max(2000).nullable().optional(),
  color: z.string().trim().max(20).nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  isAllDay: z.boolean().default(true),
  tasks: z.array(noteTaskSchema).max(50).default([]),
});

export const eventListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(EVENT_TYPES),
  status: z.enum(EVENT_STATUSES),
  visibility: z.enum(EVENT_VISIBILITIES),
  color: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string(),
  isAllDay: z.boolean(),
  location: z.string().nullable(),
  storeCount: z.number(),
  supplierCount: z.number(),
  assigneeCount: z.number(),
  checklistCount: z.number(),
  myDoneCount: z.number(),
});

export const noteItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string().nullable(),
  color: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string(),
  isAllDay: z.boolean(),
  tasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      isDone: z.boolean(),
    }),
  ),
});
