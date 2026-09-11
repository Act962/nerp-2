import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  SEVERIDADES,
  TIPOS_DE_AVISO,
} from "@/features/astro/server/avisos/tipos";
import prisma from "@/lib/db";

/**
 * Os avisos da organização, do mais grave e mais recente para o resto.
 *
 * Sempre `where: { organizationId }` — é a leitura que alimenta o selo do
 * mascote, e ela roda a cada minuto na tela de todo mundo.
 */
export const listarAvisos = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Avisos do Astro", tags: ["Astro"] })
  .input(
    z.object({
      apenasNaoLidos: z.boolean().default(false),
      limite: z.number().int().min(1).max(50).default(20),
    }),
  )
  .output(
    z.object({
      naoLidos: z.number(),
      avisos: z.array(
        z.object({
          id: z.string(),
          tipo: z.enum(TIPOS_DE_AVISO),
          severidade: z.enum(SEVERIDADES),
          titulo: z.string(),
          corpo: z.string(),
          lido: z.boolean(),
          falado: z.boolean(),
          quando: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;
    const where = {
      organizationId,
      ...(input.apenasNaoLidos ? { lidoEm: null } : {}),
    };

    const [linhas, naoLidos] = await Promise.all([
      prisma.astroAviso.findMany({
        where,
        orderBy: [
          { lidoEm: { sort: "asc", nulls: "first" } },
          { createdAt: "desc" },
        ],
        take: input.limite,
        select: {
          id: true,
          tipo: true,
          severidade: true,
          titulo: true,
          corpo: true,
          lidoEm: true,
          faladoEm: true,
          createdAt: true,
        },
      }),
      prisma.astroAviso.count({ where: { organizationId, lidoEm: null } }),
    ]);

    return {
      naoLidos,
      avisos: linhas.map((linha) => ({
        id: linha.id,
        // O banco guarda texto; a lista fechada mora em código. Um tipo que
        // não conhecemos mais não deve derrubar a tela inteira.
        tipo: (TIPOS_DE_AVISO as readonly string[]).includes(linha.tipo)
          ? (linha.tipo as (typeof TIPOS_DE_AVISO)[number])
          : ("estoque_baixo" as const),
        severidade: (SEVERIDADES as readonly string[]).includes(
          linha.severidade,
        )
          ? (linha.severidade as (typeof SEVERIDADES)[number])
          : ("baixa" as const),
        titulo: linha.titulo,
        corpo: linha.corpo,
        lido: linha.lidoEm !== null,
        falado: linha.faladoEm !== null,
        quando: linha.createdAt.toISOString(),
      })),
    };
  });
