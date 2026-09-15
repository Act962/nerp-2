import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireSiteAdminMiddleware } from "@/app/middlewares/site-admin";
import type { Prisma } from "@/generated/prisma/client";
import { SiteMelhoriaStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";

/**
 * A fila de melhorias pedidas de dentro do ERP.
 *
 * Tabela global, como as demais `site_*`, e por isso sem `organizationId` em
 * nenhuma consulta daqui: quem pediu está gravado na linha, mas o dono da fila
 * é a equipe da ÓRBITA.
 */

const siteAdmin = base
  .use(requireAuthMiddleware)
  .use(requireSiteAdminMiddleware);

const statusSchema = z.enum(SiteMelhoriaStatus);

const melhoriaSchema = z.object({
  id: z.string(),
  organizationName: z.string().nullable(),
  userName: z.string().nullable(),
  userEmail: z.string().nullable(),
  pathname: z.string(),
  mensagem: z.string(),
  imagens: z.array(z.string()),
  status: statusSchema,
  resposta: z.string().nullable(),
  respondidaEm: z.string().nullable(),
  createdAt: z.string(),
});

export const listMelhorias = siteAdmin
  .input(
    z.object({
      status: statusSchema.optional(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
  )
  .output(
    z.object({
      melhorias: z.array(melhoriaSchema),
      nextCursor: z.string().nullable(),
      novas: z.number(),
    }),
  )
  .handler(async ({ input }) => {
    const take = input.limit ?? 20;
    const where: Prisma.SiteMelhoriaWhereInput = input.status
      ? { status: input.status }
      : {};

    const [linhas, novas] = await Promise.all([
      prisma.siteMelhoria.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: take + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      }),
      prisma.siteMelhoria.count({ where: { status: "NOVA" } }),
    ]);

    const temMais = linhas.length > take;
    const pagina = temMais ? linhas.slice(0, take) : linhas;

    return {
      melhorias: pagina.map((m) => ({
        id: m.id,
        organizationName: m.organizationName,
        userName: m.userName,
        userEmail: m.userEmail,
        pathname: m.pathname,
        mensagem: m.mensagem,
        imagens: m.imagens,
        status: m.status,
        resposta: m.resposta,
        respondidaEm: m.respondidaEm?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
      nextCursor: temMais ? (pagina.at(-1)?.id ?? null) : null,
      novas,
    };
  });

export const updateMelhoria = siteAdmin
  .input(
    z.object({
      id: z.string().min(1),
      status: statusSchema.optional(),
      resposta: z.string().max(2000).nullable().optional(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não altera as melhorias" });
    }

    const atual = await prisma.siteMelhoria.findUnique({
      where: { id: input.id },
      select: { resposta: true },
    });
    if (!atual) throw errors.NOT_FOUND({ message: "Melhoria não encontrada" });

    const respostaMudou =
      input.resposta !== undefined && input.resposta !== atual.resposta;

    await prisma.siteMelhoria.update({
      where: { id: input.id },
      data: {
        status: input.status,
        resposta: input.resposta,
        // A data só se move quando a resposta muda: reabrir a tela e salvar o
        // status não pode fazer parecer que o time respondeu de novo.
        ...(respostaMudou ? { respondidaEm: new Date() } : {}),
      },
    });

    return { ok: true as const };
  });

export const deleteMelhoria = siteAdmin
  .input(z.object({ id: z.string().min(1) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (!context.siteAdmin.isSuperAdmin) {
      throw errors.FORBIDDEN({ message: "Só o super admin exclui melhorias" });
    }
    await prisma.siteMelhoria.delete({ where: { id: input.id } });
    return { ok: true as const };
  });
