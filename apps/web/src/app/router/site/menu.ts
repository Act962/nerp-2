import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireSiteAdminMiddleware } from "@/app/middlewares/site-admin";
import prisma from "@/lib/db";

const panel = z.enum(["SOLUCOES", "SEGMENTOS", "SOBRE"]);

const menuItem = z.object({
  id: z.string(),
  panel,
  groupTitle: z.string(),
  slug: z.string(),
  name: z.string(),
  summary: z.string(),
  iconKey: z.string().nullable(),
  iconImage: z.string().nullable(),
  color: z.string().nullable(),
  href: z.string().nullable(),
  pageId: z.string().nullable(),
  position: z.number(),
  visible: z.boolean(),
});

const siteAdmin = base
  .use(requireAuthMiddleware)
  .use(requireSiteAdminMiddleware);

export const listMenu = siteAdmin
  .input(z.object({ panel: panel.optional() }))
  .output(z.object({ items: z.array(menuItem) }))
  .handler(async ({ input }) => {
    const items = await prisma.siteMenuItem.findMany({
      where: { panel: input.panel },
      orderBy: [{ panel: "asc" }, { position: "asc" }],
    });
    return { items };
  });

export const saveMenuItem = siteAdmin
  .input(
    z.object({
      id: z.string().optional(),
      panel,
      groupTitle: z.string().min(1, "Informe a coluna"),
      slug: z
        .string()
        .min(1, "Informe o identificador")
        .regex(/^[a-z0-9-]+$/, "Use só letras minúsculas, números e hífen"),
      name: z.string().min(1, "Informe o nome"),
      summary: z.string().default(""),
      iconKey: z.string().nullable().default(null),
      iconImage: z.string().nullable().default(null),
      color: z.string().nullable().default(null),
      href: z.string().nullable().default(null),
      pageId: z.string().nullable().default(null),
      visible: z.boolean().default(true),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({
        message: "Redator não mexe na estrutura do menu",
      });
    }

    const { id, ...data } = input;

    if (id) {
      const existing = await prisma.siteMenuItem.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) {
        throw errors.NOT_FOUND({ message: "Item do menu não encontrado" });
      }
      const updated = await prisma.siteMenuItem.update({
        where: { id },
        data,
        select: { id: true },
      });
      return { id: updated.id };
    }

    // Item novo entra no fim da coluna dele.
    const last = await prisma.siteMenuItem.findFirst({
      where: { panel: input.panel },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const created = await prisma.siteMenuItem.create({
      data: { ...data, position: (last?.position ?? -1) + 1 },
      select: { id: true },
    });
    return { id: created.id };
  });

export const reorderMenu = siteAdmin
  .input(z.object({ panel, ids: z.array(z.string()) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não reordena o menu" });
    }

    // Só reordena o que é daquele painel: um id de fora viraria uma posição
    // órfã em outra lista.
    const owned = await prisma.siteMenuItem.findMany({
      where: { id: { in: input.ids }, panel: input.panel },
      select: { id: true },
    });
    const allowed = new Set(owned.map((i) => i.id));

    await prisma.$transaction(
      input.ids
        .filter((id) => allowed.has(id))
        .map((id, position) =>
          prisma.siteMenuItem.update({ where: { id }, data: { position } }),
        ),
    );

    return { ok: true as const };
  });

export const toggleMenuItem = siteAdmin
  .input(z.object({ id: z.string(), visible: z.boolean() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, errors }) => {
    const existing = await prisma.siteMenuItem.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Item do menu não encontrado" });
    }
    await prisma.siteMenuItem.update({
      where: { id: input.id },
      data: { visible: input.visible },
    });
    return { ok: true as const };
  });

export const deleteMenuItem = siteAdmin
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (!context.siteAdmin.isSuperAdmin) {
      throw errors.FORBIDDEN({
        message: "Só o super admin exclui item do menu",
      });
    }
    await prisma.siteMenuItem.deleteMany({ where: { id: input.id } });
    return { ok: true as const };
  });
