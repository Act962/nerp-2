import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

/**
 * As etiquetas que o operador pode pendurar num contato.
 *
 * Traz as da organização inteira **e** as do funil pedido: etiqueta de funil
 * existe para o vocabulário de um atendimento não poluir o de outro, mas as
 * gerais valem em todos.
 */
export const listTags = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Lista etiquetas", tags: ["CRM"] })
  .input(z.object({ funnelId: z.string().optional() }))
  .output(
    z.object({
      etiquetas: z.array(
        z.object({
          id: z.string(),
          nome: z.string(),
          cor: z.string().nullable(),
          grupo: z.string().nullable(),
          /** `null` quando vale para a organização inteira. */
          funnelId: z.string().nullable(),
          usos: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;

    const etiquetas = await prisma.crmTag.findMany({
      where: {
        organizationId,
        // Arquivada some do seletor mas continua resolvível no histórico.
        archivedAt: null,
        ...(input.funnelId
          ? { OR: [{ funnelId: null }, { funnelId: input.funnelId }] }
          : {}),
      },
      orderBy: [{ tagGroup: { order: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        color: true,
        funnelId: true,
        tagGroup: { select: { name: true } },
        _count: { select: { leadTags: true } },
      },
    });

    return {
      etiquetas: etiquetas.map((etiqueta) => ({
        id: etiqueta.id,
        nome: etiqueta.name,
        cor: etiqueta.color,
        grupo: etiqueta.tagGroup?.name ?? null,
        funnelId: etiqueta.funnelId,
        usos: etiqueta._count.leadTags,
      })),
    };
  });
