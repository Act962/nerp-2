import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireSiteAdminMiddleware } from "@/app/middlewares/site-admin";
import prisma from "@/lib/db";

/**
 * Os parceiros e as marcas da descida à Terra.
 *
 * Duas listas com o mesmo ciclo — listar, salvar, reordenar, mostrar, excluir —
 * e campos diferentes: parceiro tem foto e história, marca tem só o logotipo.
 *
 * Quem pode o quê segue o mesmo desenho do menu, com uma diferença: aqui o
 * REDATOR edita, porque o que ele mexe É o conteúdo ("só texto e imagem",
 * diz o papel). O que ele não faz é mudar a lista — criar, reordenar ou
 * excluir. Excluir continua sendo só do super admin.
 */

const siteAdmin = base
  .use(requireAuthMiddleware)
  .use(requireSiteAdminMiddleware);

const partner = z.object({
  id: z.string(),
  name: z.string(),
  photo: z.string().nullable(),
  logo: z.string().nullable(),
  story: z.string(),
  href: z.string().nullable(),
  position: z.number(),
  visible: z.boolean(),
});

const brand = z.object({
  id: z.string(),
  name: z.string(),
  logo: z.string(),
  href: z.string().nullable(),
  position: z.number(),
  visible: z.boolean(),
});

const ordem = [{ position: "asc" as const }, { createdAt: "asc" as const }];

/* --- parceiros ---------------------------------------------------------- */

export const listPartners = siteAdmin
  .input(z.object({}))
  .output(z.object({ items: z.array(partner) }))
  .handler(async () => {
    const items = await prisma.sitePartner.findMany({ orderBy: ordem });
    return { items };
  });

export const savePartner = siteAdmin
  .input(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1, "Informe o nome do parceiro"),
      // Os dois opcionais: o cartão se vira com o que tiver.
      photo: z.string().nullable().default(null),
      logo: z.string().nullable().default(null),
      story: z.string().default(""),
      href: z.string().nullable().default(null),
      visible: z.boolean().default(true),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const { id, ...data } = input;

    if (id) {
      const existing = await prisma.sitePartner.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) {
        throw errors.NOT_FOUND({ message: "Parceiro não encontrado" });
      }
      const updated = await prisma.sitePartner.update({
        where: { id },
        data,
        select: { id: true },
      });
      return { id: updated.id };
    }

    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não cria parceiro" });
    }

    const last = await prisma.sitePartner.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const created = await prisma.sitePartner.create({
      data: { ...data, position: (last?.position ?? -1) + 1 },
      select: { id: true },
    });
    return { id: created.id };
  });

export const reorderPartners = siteAdmin
  .input(z.object({ ids: z.array(z.string()) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não reordena a lista" });
    }
    // Só o que existe: um id de fora viraria uma posição órfã.
    const owned = await prisma.sitePartner.findMany({
      where: { id: { in: input.ids } },
      select: { id: true },
    });
    const allowed = new Set(owned.map((item) => item.id));

    await prisma.$transaction(
      input.ids
        .filter((id) => allowed.has(id))
        .map((id, position) =>
          prisma.sitePartner.update({ where: { id }, data: { position } }),
        ),
    );
    return { ok: true as const };
  });

export const togglePartner = siteAdmin
  .input(z.object({ id: z.string(), visible: z.boolean() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, errors }) => {
    const existing = await prisma.sitePartner.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Parceiro não encontrado" });
    }
    await prisma.sitePartner.update({
      where: { id: input.id },
      data: { visible: input.visible },
    });
    return { ok: true as const };
  });

export const deletePartner = siteAdmin
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (!context.siteAdmin.isSuperAdmin) {
      throw errors.FORBIDDEN({ message: "Só o super admin exclui parceiro" });
    }
    await prisma.sitePartner.deleteMany({ where: { id: input.id } });
    return { ok: true as const };
  });

/* --- marcas ------------------------------------------------------------- */

export const listBrands = siteAdmin
  .input(z.object({}))
  .output(z.object({ items: z.array(brand) }))
  .handler(async () => {
    const items = await prisma.siteBrand.findMany({ orderBy: ordem });
    return { items };
  });

export const saveBrand = siteAdmin
  .input(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1, "Informe o nome da marca"),
      // Marca sem logo não desenha quadro nenhum — por isso é obrigatório aqui.
      logo: z.string().min(1, "Escolha o logotipo"),
      href: z.string().nullable().default(null),
      visible: z.boolean().default(true),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const { id, ...data } = input;

    if (id) {
      const existing = await prisma.siteBrand.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) {
        throw errors.NOT_FOUND({ message: "Marca não encontrada" });
      }
      const updated = await prisma.siteBrand.update({
        where: { id },
        data,
        select: { id: true },
      });
      return { id: updated.id };
    }

    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não cria marca" });
    }

    const last = await prisma.siteBrand.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const created = await prisma.siteBrand.create({
      data: { ...data, position: (last?.position ?? -1) + 1 },
      select: { id: true },
    });
    return { id: created.id };
  });

export const reorderBrands = siteAdmin
  .input(z.object({ ids: z.array(z.string()) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não reordena a lista" });
    }
    const owned = await prisma.siteBrand.findMany({
      where: { id: { in: input.ids } },
      select: { id: true },
    });
    const allowed = new Set(owned.map((item) => item.id));

    await prisma.$transaction(
      input.ids
        .filter((id) => allowed.has(id))
        .map((id, position) =>
          prisma.siteBrand.update({ where: { id }, data: { position } }),
        ),
    );
    return { ok: true as const };
  });

export const toggleBrand = siteAdmin
  .input(z.object({ id: z.string(), visible: z.boolean() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, errors }) => {
    const existing = await prisma.siteBrand.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Marca não encontrada" });
    }
    await prisma.siteBrand.update({
      where: { id: input.id },
      data: { visible: input.visible },
    });
    return { ok: true as const };
  });

export const deleteBrand = siteAdmin
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (!context.siteAdmin.isSuperAdmin) {
      throw errors.FORBIDDEN({ message: "Só o super admin exclui marca" });
    }
    await prisma.siteBrand.deleteMany({ where: { id: input.id } });
    return { ok: true as const };
  });
