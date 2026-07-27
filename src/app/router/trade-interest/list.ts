import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Inbox de leads do TradeGram para o dono da loja. Escopado por org. Filtra por
// status opcional; mais recentes primeiro.
export const listInterests = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      status: z.enum(["NOVO", "EM_CONTATO", "GANHO", "ARQUIVADO"]).optional(),
      storeId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;

    const [interests, counts] = await Promise.all([
      prisma.spaceInterest.findMany({
        where: {
          organizationId,
          status: input.status,
          storeId: input.storeId,
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          kind: true,
          status: true,
          spaceCode: true,
          spaceLabel: true,
          name: true,
          company: true,
          email: true,
          phone: true,
          message: true,
          createdAt: true,
          store: { select: { id: true, name: true, city: true } },
        },
      }),
      prisma.spaceInterest.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: true,
      }),
    ]);

    const countByStatus = (status: string) =>
      counts.find((row) => row.status === status)?._count ?? 0;

    return {
      interests,
      counts: {
        novo: countByStatus("NOVO"),
        emContato: countByStatus("EM_CONTATO"),
        ganho: countByStatus("GANHO"),
        arquivado: countByStatus("ARQUIVADO"),
        total: counts.reduce((sum, row) => sum + row._count, 0),
      },
    };
  });
