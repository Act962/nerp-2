import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireFunnelDaOrg } from "./_access";

/**
 * Colunas do funil, na ordem do board.
 *
 * `order` é `Decimal` no banco (o board move card pelo ponto médio entre
 * vizinhos, sem renumerar a coluna inteira) e sai como número aqui.
 */
export const listStages = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Lista as etapas do funil", tags: ["CRM"] })
  .input(z.object({ funnelId: z.string().min(1) }))
  .output(
    z.object({
      etapas: z.array(
        z.object({
          id: z.string(),
          nome: z.string(),
          cor: z.string().nullable(),
          ordem: z.number(),
          totalDeLeads: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireFunnelDaOrg(input.funnelId, context.org.id);

    const etapas = await prisma.crmStage.findMany({
      where: { funnelId: input.funnelId, organizationId: context.org.id },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        order: true,
        _count: { select: { leads: { where: { isArchived: false } } } },
      },
    });

    return {
      etapas: etapas.map((etapa) => ({
        id: etapa.id,
        nome: etapa.name,
        cor: etapa.color,
        ordem: Number(etapa.order),
        totalDeLeads: etapa._count.leads,
      })),
    };
  });
