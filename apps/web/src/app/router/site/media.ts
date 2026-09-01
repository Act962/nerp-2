import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireSiteAdminMiddleware } from "@/app/middlewares/site-admin";
import prisma from "@/lib/db";

const siteAdmin = base
  .use(requireAuthMiddleware)
  .use(requireSiteAdminMiddleware);

/**
 * O arquivo em si vai direto do navegador para o R2 pela URL presignada de
 * `/api/s3/upload` (`uploadToR2`). Aqui só entra o REGISTRO, para a tela de
 * Mídia listar sem ter de varrer o bucket.
 */
export const registerMedia = siteAdmin
  .input(
    z.object({
      key: z.string().min(1),
      fileName: z.string().min(1),
      contentType: z.string().min(1),
      size: z.number().int().nonnegative(),
      width: z.number().int().positive().nullable().default(null),
      height: z.number().int().positive().nullable().default(null),
      alt: z.string().default(""),
    }),
  )
  .output(z.object({ id: z.string(), key: z.string() }))
  .handler(async ({ input, context }) => {
    const media = await prisma.siteMedia.upsert({
      where: { key: input.key },
      create: {
        key: input.key,
        fileName: input.fileName,
        contentType: input.contentType,
        size: input.size,
        width: input.width,
        height: input.height,
        alt: input.alt || null,
        createdById: context.siteAdmin.email,
      },
      update: { alt: input.alt || null },
      select: { id: true, key: true },
    });
    return media;
  });

export const listMedia = siteAdmin
  .input(z.object({ limit: z.number().int().min(1).max(200).default(60) }))
  .output(
    z.object({
      media: z.array(
        z.object({
          id: z.string(),
          key: z.string(),
          fileName: z.string(),
          contentType: z.string(),
          size: z.number(),
          width: z.number().nullable(),
          height: z.number().nullable(),
          alt: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input }) => {
    const rows = await prisma.siteMedia.findMany({
      orderBy: { createdAt: "desc" },
      take: input.limit,
    });
    return {
      media: rows.map((m) => ({
        id: m.id,
        key: m.key,
        fileName: m.fileName,
        contentType: m.contentType,
        size: m.size,
        width: m.width,
        height: m.height,
        alt: m.alt,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  });

/**
 * Tira da lista. O objeto continua no bucket de propósito: uma página antiga
 * ainda pode apontar para ele, e apagar um arquivo que alguma página usa é
 * estrago que não dá para desfazer pela tela.
 */
export const removeMedia = siteAdmin
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não remove imagem" });
    }
    await prisma.siteMedia.deleteMany({ where: { id: input.id } });
    return { ok: true as const };
  });
