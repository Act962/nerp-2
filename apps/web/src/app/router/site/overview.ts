import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireSiteAdminMiddleware } from "@/app/middlewares/site-admin";
import prisma from "@/lib/db";

const siteAdmin = base
  .use(requireAuthMiddleware)
  .use(requireSiteAdminMiddleware);

/** Os números e a lista de pendências do painel. */
export const siteOverview = siteAdmin
  .input(z.object({}))
  .output(
    z.object({
      counts: z.object({
        solucoes: z.number(),
        segmentos: z.number(),
        publicadas: z.number(),
        rascunhos: z.number(),
      }),
      pending: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          detail: z.string(),
          slug: z.string(),
        }),
      ),
    }),
  )
  .handler(async () => {
    const [solucoes, segmentos, publicadas, pages] = await Promise.all([
      prisma.siteMenuItem.count({ where: { panel: "SOLUCOES" } }),
      prisma.siteMenuItem.count({ where: { panel: "SEGMENTOS" } }),
      prisma.sitePage.count({ where: { status: "PUBLISHED" } }),
      prisma.sitePage.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          blocks: true,
          publishedBlocks: true,
        },
      }),
    ]);

    // "Pendente" é rascunho diferente do que está no ar — inclusive página
    // nunca publicada, que é o caso mais comum de esquecer.
    const pending = pages
      .filter(
        (p) =>
          JSON.stringify(p.blocks ?? []) !==
          JSON.stringify(p.publishedBlocks ?? null),
      )
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        detail:
          p.status === "PUBLISHED"
            ? "alterações salvas e ainda não publicadas"
            : "nunca publicada",
      }));

    return {
      counts: {
        solucoes,
        segmentos,
        publicadas,
        rascunhos: pending.length,
      },
      pending,
    };
  });
