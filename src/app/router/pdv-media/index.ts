import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { memberHasPermission } from "@/lib/permissions";
import { z } from "zod";
import { getCaixaMember } from "../caixa/_access";

const p = base.use(requireAuthMiddleware).use(requireOrgMiddleware);

const mediaOutput = z.object({
  id: z.string(),
  title: z.string().nullable(),
  url: z.string(),
  type: z.enum(["IMAGE", "VIDEO"]),
  durationSeconds: z.number(),
  order: z.number(),
  isActive: z.boolean(),
});

const settingsOutput = z.object({
  enabled: z.boolean(),
  pauseSeconds: z.number(),
});

// Gerenciar a mídia exige a permissão de página "midia-pdv" (owner/admin
// passam sempre via memberHasPermission).
async function requireManage(
  orgId: string,
  userId: string,
  errors: { FORBIDDEN: (o: { message: string }) => Error },
) {
  const member = await getCaixaMember(orgId, userId);
  if (!memberHasPermission(member, "midia-pdv"))
    throw errors.FORBIDDEN({
      message: "Você não tem permissão para gerenciar a mídia do PDV",
    });
}

// Painel do PDV: só mídias ativas + config. Qualquer membro lê (o operador vê).
const panel = p
  .input(z.object({}).optional())
  .output(
    z.object({
      medias: z.array(mediaOutput),
      settings: settingsOutput,
    }),
  )
  .handler(async ({ context }) => {
    const [org, medias] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: context.org.id },
        select: { pdvMediaEnabled: true, pdvMediaPauseSeconds: true },
      }),
      prisma.pdvMedia.findMany({
        where: { organizationId: context.org.id, isActive: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          url: true,
          type: true,
          durationSeconds: true,
          order: true,
          isActive: true,
        },
      }),
    ]);
    return {
      medias,
      settings: {
        enabled: org?.pdvMediaEnabled ?? false,
        pauseSeconds: org?.pdvMediaPauseSeconds ?? 1,
      },
    };
  });

// Tela de gestão: todas as mídias (ativas e inativas) + config.
const list = p
  .input(z.object({}).optional())
  .output(
    z.object({
      medias: z.array(mediaOutput),
      settings: settingsOutput,
    }),
  )
  .handler(async ({ context }) => {
    const [org, medias] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: context.org.id },
        select: { pdvMediaEnabled: true, pdvMediaPauseSeconds: true },
      }),
      prisma.pdvMedia.findMany({
        where: { organizationId: context.org.id },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          url: true,
          type: true,
          durationSeconds: true,
          order: true,
          isActive: true,
        },
      }),
    ]);
    return {
      medias,
      settings: {
        enabled: org?.pdvMediaEnabled ?? false,
        pauseSeconds: org?.pdvMediaPauseSeconds ?? 1,
      },
    };
  });

const create = p
  .input(
    z.object({
      title: z.string().max(120).optional(),
      url: z.string().min(1, "Envie o arquivo da mídia"),
      type: z.enum(["IMAGE", "VIDEO"]),
      durationSeconds: z.number().int().min(1).max(600).optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    await requireManage(context.org.id, context.user.id, errors);
    // Nova mídia entra no fim da fila.
    const last = await prisma.pdvMedia.findFirst({
      where: { organizationId: context.org.id },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const created = await prisma.pdvMedia.create({
      data: {
        organizationId: context.org.id,
        createdById: context.user.id,
        title: input.title?.trim() || null,
        url: input.url,
        type: input.type,
        durationSeconds: input.durationSeconds ?? 8,
        order: (last?.order ?? -1) + 1,
      },
      select: { id: true },
    });
    return created;
  });

const update = p
  .input(
    z.object({
      id: z.string(),
      title: z.string().max(120).nullable().optional(),
      durationSeconds: z.number().int().min(1).max(600).optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    await requireManage(context.org.id, context.user.id, errors);
    const media = await prisma.pdvMedia.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!media) throw errors.NOT_FOUND({ message: "Mídia não encontrada" });
    await prisma.pdvMedia.update({
      where: { id: input.id },
      data: {
        title:
          input.title === undefined ? undefined : input.title?.trim() || null,
        durationSeconds: input.durationSeconds,
        isActive: input.isActive,
      },
    });
    return { ok: true };
  });

const remove = p
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    await requireManage(context.org.id, context.user.id, errors);
    const media = await prisma.pdvMedia.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!media) throw errors.NOT_FOUND({ message: "Mídia não encontrada" });
    await prisma.pdvMedia.delete({ where: { id: input.id } });
    return { ok: true };
  });

// Reordena a lista inteira: recebe os ids na nova ordem.
const reorder = p
  .input(z.object({ ids: z.array(z.string()).min(1) }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    await requireManage(context.org.id, context.user.id, errors);
    // Só reordena mídias que são desta org (re-valida os ids).
    const owned = await prisma.pdvMedia.findMany({
      where: { id: { in: input.ids }, organizationId: context.org.id },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((m) => m.id));
    await prisma.$transaction(
      input.ids
        .filter((id) => ownedIds.has(id))
        .map((id, index) =>
          prisma.pdvMedia.update({
            where: { id },
            data: { order: index },
          }),
        ),
    );
    return { ok: true };
  });

const updateSettings = p
  .input(
    z.object({
      enabled: z.boolean().optional(),
      pauseSeconds: z.number().int().min(0).max(60).optional(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    await requireManage(context.org.id, context.user.id, errors);
    await prisma.organization.update({
      where: { id: context.org.id },
      data: {
        pdvMediaEnabled: input.enabled,
        pdvMediaPauseSeconds: input.pauseSeconds,
      },
    });
    return { ok: true };
  });

export const pdvMediaRoutes = {
  panel,
  list,
  create,
  update,
  delete: remove,
  reorder,
  updateSettings,
};
