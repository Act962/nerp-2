import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireSiteAdminMiddleware } from "@/app/middlewares/site-admin";
import prisma from "@/lib/db";

/**
 * As áreas da empresa que organizam o painel de Soluções.
 *
 * Estrutura, não conteúdo — então segue o desenho do menu: o REDATOR não cria,
 * edita, reordena nem esconde área; excluir continua sendo só do super admin.
 */

const area = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  iconKey: z.string().nullable(),
  iconImage: z.string().nullable(),
  color: z.string().nullable(),
  position: z.number(),
  visible: z.boolean(),
});

const siteAdmin = base
  .use(requireAuthMiddleware)
  .use(requireSiteAdminMiddleware);

const ordem = [{ position: "asc" as const }, { createdAt: "asc" as const }];

export const listAreas = siteAdmin
  .input(z.object({}))
  .output(z.object({ items: z.array(area) }))
  .handler(async () => {
    const items = await prisma.siteSolutionArea.findMany({ orderBy: ordem });
    return { items };
  });

export const saveArea = siteAdmin
  .input(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1, "Informe o nome da área"),
      slug: z
        .string()
        .min(1, "Informe o identificador")
        .regex(/^[a-z0-9-]+$/, "Use só letras minúsculas, números e hífen"),
      iconKey: z.string().nullable().default(null),
      iconImage: z.string().nullable().default(null),
      color: z.string().nullable().default(null),
      visible: z.boolean().default(true),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não mexe nas áreas" });
    }

    const { id, ...data } = input;

    // Slug é a identidade que casa com o banco e o fallback do código: um
    // choque deve virar mensagem, não um 500 de constraint.
    const clash = await prisma.siteSolutionArea.findFirst({
      where: { slug: data.slug, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    if (clash) {
      throw errors.BAD_REQUEST({
        message: "Já existe uma área com esse identificador",
      });
    }

    if (id) {
      const existing = await prisma.siteSolutionArea.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) {
        throw errors.NOT_FOUND({ message: "Área não encontrada" });
      }
      const updated = await prisma.siteSolutionArea.update({
        where: { id },
        data,
        select: { id: true },
      });
      return { id: updated.id };
    }

    const last = await prisma.siteSolutionArea.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const created = await prisma.siteSolutionArea.create({
      data: { ...data, position: (last?.position ?? -1) + 1 },
      select: { id: true },
    });
    return { id: created.id };
  });

export const reorderAreas = siteAdmin
  .input(z.object({ ids: z.array(z.string()) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não reordena as áreas" });
    }
    const owned = await prisma.siteSolutionArea.findMany({
      where: { id: { in: input.ids } },
      select: { id: true },
    });
    const allowed = new Set(owned.map((item) => item.id));

    await prisma.$transaction(
      input.ids
        .filter((id) => allowed.has(id))
        .map((id, position) =>
          prisma.siteSolutionArea.update({ where: { id }, data: { position } }),
        ),
    );
    return { ok: true as const };
  });

export const toggleArea = siteAdmin
  .input(z.object({ id: z.string(), visible: z.boolean() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não esconde área" });
    }
    const existing = await prisma.siteSolutionArea.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Área não encontrada" });
    }
    await prisma.siteSolutionArea.update({
      where: { id: input.id },
      data: { visible: input.visible },
    });
    return { ok: true as const };
  });

export const deleteArea = siteAdmin
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (!context.siteAdmin.isSuperAdmin) {
      throw errors.FORBIDDEN({ message: "Só o super admin exclui área" });
    }
    // O cascade da junção leva as memberships junto; as soluções continuam.
    await prisma.siteSolutionArea.deleteMany({ where: { id: input.id } });
    return { ok: true as const };
  });
