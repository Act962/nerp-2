import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Indicadores da aba "Aprovação de fotos": distribuição por tipo de mídia
// (doughnut) e ranking de promotores. Escopo: fotos aprovadas da org (com
// filtro opcional por indústria pra casar com a barra de filtros).
export const bookApprovalInsights = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ supplierId: z.string().optional() }).optional())
  .handler(async ({ input, context }) => {
    const where = {
      organizationId: context.org.id,
      approvalStatus: "APPROVED" as const,
      promoterName: { not: null },
      ...(input?.supplierId ? { supplierId: input.supplierId } : {}),
    };

    const [byMedia, byPromoter, promoterMembers, activePromoters] =
      await Promise.all([
        prisma.pdvPhoto.groupBy({
          by: ["mediaTypeId"],
          where: { ...where, mediaTypeId: { not: null } },
          _count: { _all: true },
        }),
        prisma.pdvPhoto.groupBy({
          by: ["promoterName"],
          where,
          _count: { _all: true },
          orderBy: { _count: { promoterName: "desc" } },
          take: 6,
        }),
        // "Promotores": membros que aparecem no carimbo da foto.
        prisma.member.findMany({
          where: {
            organizationId: context.org.id,
            showInPromotorPhoto: true,
          },
          select: { user: { select: { name: true } } },
        }),
        // Quem tem foto aprovada no escopo (nomes distintos).
        prisma.pdvPhoto.findMany({
          where,
          select: { promoterName: true },
          distinct: ["promoterName"],
        }),
      ]);

    const activeNames = new Set(
      activePromoters.map((p) => p.promoterName).filter(Boolean),
    );
    const withoutPhotos = promoterMembers
      .map((m) => m.user?.name)
      .filter((n): n is string => !!n && !activeNames.has(n));

    const types = await prisma.mediaType.findMany({
      where: {
        id: {
          in: byMedia.map((m) => m.mediaTypeId).filter((v): v is string => !!v),
        },
      },
      select: { id: true, code: true, name: true },
    });
    const typeById = new Map(types.map((t) => [t.id, t]));

    const mediaDistribution = byMedia
      .map((m) => {
        const t = m.mediaTypeId ? typeById.get(m.mediaTypeId) : null;
        return {
          mediaTypeId: m.mediaTypeId,
          code: t?.code ?? "—",
          name: t?.name ?? "Sem tipo",
          count: m._count._all,
        };
      })
      .sort((a, b) => b.count - a.count);

    const promoterRanking = byPromoter
      .filter((p) => p.promoterName)
      .map((p) => ({ name: p.promoterName as string, count: p._count._all }));

    return {
      mediaDistribution,
      promoterRanking,
      promotersWithoutPhotos: {
        total: promoterMembers.length,
        names: withoutPhotos,
      },
    };
  });
