import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireSiteAdminMiddleware } from "@/app/middlewares/site-admin";
import type { Prisma } from "@/generated/prisma/client";
import { SiteLeadStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";

/**
 * Os interessados que saíram das conversas com o Astro.
 *
 * Tabela global do site, como as demais `site_*` — o lead é da ÓRBITA, não de
 * um inquilino. Por isso não há `organizationId` em nenhuma query aqui, e a
 * guarda é o `requireSiteAdminMiddleware`.
 */

const siteAdmin = base
  .use(requireAuthMiddleware)
  .use(requireSiteAdminMiddleware);

const statusSchema = z.enum(SiteLeadStatus);

const leadSchema = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  segment: z.string().nullable(),
  stores: z.number().nullable(),
  users: z.number().nullable(),
  toolIds: z.array(z.string()),
  quotedMinCents: z.number().nullable(),
  quotedMaxCents: z.number().nullable(),
  status: statusSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
  handoffAt: z.string().nullable(),
});

export const listLeads = siteAdmin
  .input(
    z.object({
      status: statusSchema.optional(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
  )
  .output(
    z.object({
      leads: z.array(leadSchema),
      nextCursor: z.string().nullable(),
      novos: z.number(),
    }),
  )
  .handler(async ({ input }) => {
    const take = input.limit ?? 20;
    const where: Prisma.SiteLeadWhereInput = input.status
      ? { status: input.status }
      : {};

    const [rows, novos] = await Promise.all([
      prisma.siteLead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: take + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      }),
      prisma.siteLead.count({ where: { status: "NOVO" } }),
    ]);

    const nextCursor = rows.length > take ? rows[take].id : null;

    return {
      leads: rows.slice(0, take).map((lead) => ({
        ...lead,
        createdAt: lead.createdAt.toISOString(),
        handoffAt: lead.handoffAt?.toISOString() ?? null,
      })),
      nextCursor,
      novos,
    };
  });

/** O lead com o diagnóstico inteiro — o que vira a proposta no Forge. */
export const getLead = siteAdmin
  .input(z.object({ id: z.string() }))
  .output(
    z.object({
      lead: leadSchema.extend({
        briefing: z.unknown().nullable(),
        conversas: z.array(
          z.object({
            id: z.string(),
            createdAt: z.string(),
            messageCount: z.number(),
            summary: z.string().nullable(),
            landingPage: z.string().nullable(),
            utmSource: z.string().nullable(),
            tokensIn: z.number(),
            tokensOut: z.number(),
          }),
        ),
      }),
    }),
  )
  .handler(async ({ input, errors }) => {
    const lead = await prisma.siteLead.findUnique({
      where: { id: input.id },
      include: {
        sessions: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
            messageCount: true,
            summary: true,
            landingPage: true,
            utmSource: true,
            tokensIn: true,
            tokensOut: true,
          },
        },
      },
    });
    if (!lead) throw errors.NOT_FOUND({ message: "Lead não encontrado" });

    const { sessions, ...resto } = lead;
    return {
      lead: {
        ...resto,
        createdAt: lead.createdAt.toISOString(),
        handoffAt: lead.handoffAt?.toISOString() ?? null,
        conversas: sessions.map((s) => ({
          ...s,
          createdAt: s.createdAt.toISOString(),
        })),
      },
    };
  });

export const updateLead = siteAdmin
  .input(
    z.object({
      id: z.string(),
      status: statusSchema.optional(),
      notes: z.string().max(4000).optional(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, errors }) => {
    const existe = await prisma.siteLead.findUnique({
      where: { id: input.id },
      select: { id: true, handoffAt: true },
    });
    if (!existe) throw errors.NOT_FOUND({ message: "Lead não encontrado" });

    await prisma.siteLead.update({
      where: { id: input.id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        // A primeira mudança para "em contato" marca quando alguém pegou.
        ...(input.status === "EM_CONTATO" && !existe.handoffAt
          ? { handoffAt: new Date() }
          : {}),
      },
    });
    return { ok: true as const };
  });

/**
 * Apaga o lead e as conversas dele, de uma vez.
 *
 * É o botão de LGPD: quando alguém pede para ser esquecido, some tudo. Só o
 * super admin, como no resto do admin do site.
 */
export const deleteLead = siteAdmin
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role !== "SUPER_ADMIN") {
      throw errors.FORBIDDEN({ message: "Só o super admin exclui leads" });
    }
    await prisma.$transaction([
      prisma.siteChatSession.deleteMany({ where: { leadId: input.id } }),
      prisma.siteLead.deleteMany({ where: { id: input.id } }),
    ]);
    return { ok: true as const };
  });
