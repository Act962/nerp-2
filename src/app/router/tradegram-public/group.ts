import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";
import { loadGroupStats, loadPerStoreStats } from "./_stats";

// Feed público do grupo (TradeGram). Sem auth: a org é resolvida pelo slug e só
// responde se `isPublicProfile` estiver ligado — esse gate é a trava de opt-in.
export const getPublicGroup = base
  .route({
    method: "GET",
    summary: "Grupo público (TradeGram)",
    tags: ["tradegram-public"],
  })
  .input(z.object({ orgSlug: z.string().min(1) }))
  .handler(async ({ input, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { slug: input.orgSlug },
      select: {
        id: true,
        name: true,
        tradeName: true,
        slug: true,
        sigla: true,
        logo: true,
        primaryColor: true,
        isPublicProfile: true,
      },
    });
    if (!org || !org.isPublicProfile) {
      throw errors.NOT_FOUND({ message: "Perfil não encontrado" });
    }

    const [stats, perStore, stores] = await Promise.all([
      loadGroupStats(org.id),
      loadPerStoreStats(org.id),
      prisma.store.findMany({
        where: { organizationId: org.id, isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          code: true,
          city: true,
          state: true,
          coverImageKey: true,
        },
      }),
    ]);

    return {
      header: {
        name: org.name,
        tradeName: org.tradeName,
        handle: org.slug,
        sigla: org.sigla,
        logoKey: org.logo,
        primaryColor: org.primaryColor,
      },
      stats,
      stores: stores.map((store) => {
        const tile = perStore.get(store.id) ?? { espacos: 0, negociados: 0 };
        return {
          id: store.id,
          name: store.name,
          code: store.code,
          city: store.city,
          state: store.state,
          coverImageKey: store.coverImageKey,
          // statA = espaços totais; statB = negociados/executados.
          statA: tile.espacos,
          statB: tile.negociados,
        };
      }),
    };
  });
