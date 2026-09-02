import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireSiteAdminMiddleware } from "@/app/middlewares/site-admin";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { parseBlocks, siteBlocks } from "@nerp/site-content";

const siteAdmin = base
  .use(requireAuthMiddleware)
  .use(requireSiteAdminMiddleware);

const secao = z.enum(["SOLUCOES", "SEGMENTOS", "SOBRE"]);

const pageSummary = z.object({
  id: z.string(),
  slug: z.string(),
  section: secao,
  title: z.string(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  /** true quando o rascunho está diferente do que está no ar. */
  hasChanges: z.boolean(),
  updatedAt: z.string(),
});

export const listPages = siteAdmin
  .input(z.object({ search: z.string().optional() }))
  .output(z.object({ pages: z.array(pageSummary) }))
  .handler(async ({ input }) => {
    const rows = await prisma.sitePage.findMany({
      where: input.search
        ? { title: { contains: input.search, mode: "insensitive" } }
        : undefined,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        slug: true,
        section: true,
        title: true,
        status: true,
        blocks: true,
        publishedBlocks: true,
        updatedAt: true,
      },
    });

    return {
      pages: rows.map((p) => ({
        id: p.id,
        slug: p.slug,
        section: p.section,
        title: p.title,
        status: p.status,
        hasChanges:
          JSON.stringify(p.blocks ?? []) !==
          JSON.stringify(p.publishedBlocks ?? null),
        updatedAt: p.updatedAt.toISOString(),
      })),
    };
  });

export const getPage = siteAdmin
  .input(z.object({ id: z.string().optional(), slug: z.string().optional() }))
  .output(
    z.object({
      id: z.string(),
      slug: z.string(),
      section: secao,
      title: z.string(),
      status: z.enum(["DRAFT", "PUBLISHED"]),
      blocks: siteBlocks,
      seoTitle: z.string(),
      seoDescription: z.string(),
      ogImage: z.string(),
      publishedAt: z.string().nullable(),
    }),
  )
  .handler(async ({ input, errors }) => {
    if (!input.id && !input.slug) {
      throw errors.BAD_REQUEST({ message: "Informe a página" });
    }

    const page = await prisma.sitePage.findFirst({
      where: input.id ? { id: input.id } : { slug: input.slug },
    });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    return {
      id: page.id,
      slug: page.slug,
      section: page.section,
      title: page.title,
      status: page.status,
      blocks: parseBlocks(page.blocks),
      seoTitle: page.seoTitle ?? "",
      seoDescription: page.seoDescription ?? "",
      ogImage: page.ogImage ?? "",
      publishedAt: page.publishedAt?.toISOString() ?? null,
    };
  });

export const createPage = siteAdmin
  .input(
    z.object({
      title: z.string().min(1, "Informe o título"),
      slug: z
        .string()
        .min(1, "Informe o endereço")
        .regex(/^[a-z0-9-]+$/, "Use só letras minúsculas, números e hífen"),
      section: secao.default("SOLUCOES"),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não cria página" });
    }

    const taken = await prisma.sitePage.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (taken) {
      throw errors.BAD_REQUEST({
        message: "Já existe uma página nesse endereço",
      });
    }

    const page = await prisma.sitePage.create({
      data: {
        title: input.title,
        slug: input.slug,
        section: input.section,
        blocks: [],
      },
      select: { id: true },
    });
    return { id: page.id };
  });

export const savePage = siteAdmin
  .input(
    z.object({
      id: z.string(),
      title: z.string().min(1, "Informe o título"),
      blocks: siteBlocks,
      seoTitle: z.string().default(""),
      seoDescription: z.string().default(""),
      ogImage: z.string().default(""),
      /** Salvar e publicar de uma vez, que é o botão da tela. */
      publish: z.boolean().default(false),
    }),
  )
  // `published` diz o que ESTA chamada fez, não o estado da página: salvar
  // rascunho de uma página já no ar mantém o status PUBLISHED, e a tela
  // precisa saber a diferença para não dizer "publicado" sem ter publicado.
  .output(
    z.object({
      id: z.string(),
      status: z.enum(["DRAFT", "PUBLISHED"]),
      published: z.boolean(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const existing = await prisma.sitePage.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existing) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    const blocks = input.blocks as unknown as Prisma.InputJsonValue;

    const page = await prisma.sitePage.update({
      where: { id: input.id },
      data: {
        title: input.title,
        blocks,
        seoTitle: input.seoTitle || null,
        seoDescription: input.seoDescription || null,
        ogImage: input.ogImage || null,
        ...(input.publish
          ? {
              publishedBlocks: blocks,
              status: "PUBLISHED" as const,
              publishedAt: new Date(),
            }
          : {}),
      },
      select: { id: true, status: true },
    });

    return { ...page, published: input.publish };
  });

export const publishPage = siteAdmin
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, errors }) => {
    const page = await prisma.sitePage.findUnique({
      where: { id: input.id },
      select: { blocks: true },
    });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    await prisma.sitePage.update({
      where: { id: input.id },
      data: {
        publishedBlocks: page.blocks as Prisma.InputJsonValue,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    return { ok: true as const };
  });

/** Tira do ar sem apagar: o rascunho continua editável. */
export const unpublishPage = siteAdmin
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não tira página do ar" });
    }
    const page = await prisma.sitePage.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    await prisma.sitePage.update({
      where: { id: input.id },
      data: { status: "DRAFT", publishedBlocks: Prisma.DbNull },
    });
    return { ok: true as const };
  });

export const deletePage = siteAdmin
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (!context.siteAdmin.isSuperAdmin) {
      throw errors.FORBIDDEN({ message: "Só o super admin exclui página" });
    }
    await prisma.sitePage.deleteMany({ where: { id: input.id } });
    return { ok: true as const };
  });
