import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Quantas fotos aprovadas cada loja tem para uma indústria — usado no seletor
// de loja do picker "Adicionar foto" pra mostrar a contagem ao lado de cada
// loja/cliente.
export const approvedPhotoCountByStore = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ supplierId: z.string().optional() }))
  .handler(async ({ input, context }) => {
    const grouped = await prisma.pdvPhoto.groupBy({
      by: ["storeId"],
      where: {
        organizationId: context.org.id,
        approvalStatus: "APPROVED",
        promoterName: { not: null },
        ...(input.supplierId ? { supplierId: input.supplierId } : {}),
      },
      _count: { _all: true },
    });
    return {
      counts: grouped.map((row) => ({
        storeId: row.storeId,
        count: row._count._all,
      })),
    };
  });
