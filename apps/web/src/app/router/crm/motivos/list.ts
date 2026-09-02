import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireFunnelDaOrg } from "@/app/router/crm/_access";
import prisma from "@/lib/db";

export const listReasons = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Motivos de ganho/perda", tags: ["CRM"] })
  .input(z.object({ funnelId: z.string().min(1) }))
  .output(
    z.object({
      motivos: z.array(
        z.object({
          id: z.string(),
          nome: z.string(),
          tipo: z.enum(["WIN", "LOSS"]),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireFunnelDaOrg(input.funnelId, context.org.id);

    const motivos = await prisma.crmWinLossReason.findMany({
      where: {
        funnelId: input.funnelId,
        organizationId: context.org.id,
        isActive: true,
      },
      orderBy: [{ type: "asc" }, { order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    });

    return {
      motivos: motivos.map((motivo) => ({
        id: motivo.id,
        nome: motivo.name,
        tipo: motivo.type,
      })),
    };
  });
