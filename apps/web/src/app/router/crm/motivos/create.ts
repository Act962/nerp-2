import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireFunnelDaOrg } from "@/app/router/crm/_access";
import prisma from "@/lib/db";

export const createReason = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Cria motivo", tags: ["CRM"] })
  .input(
    z.object({
      funnelId: z.string().min(1),
      nome: z.string().trim().min(1, "Informe o motivo").max(60),
      tipo: z.enum(["WIN", "LOSS"]),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;
    await requireFunnelDaOrg(input.funnelId, organizationId);

    const ultimo = await prisma.crmWinLossReason.findFirst({
      where: { funnelId: input.funnelId, type: input.tipo },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const criado = await prisma.crmWinLossReason.create({
      data: {
        organizationId,
        funnelId: input.funnelId,
        name: input.nome,
        type: input.tipo,
        order: (ultimo?.order ?? 0) + 1,
      },
      select: { id: true },
    });

    return criado;
  });
