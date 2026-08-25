import z from "zod";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { resolveSalesGoalRankingSettings } from "./_ranking-data";

// Rota pública (sem requireAuth): configurações de exibição do ranking (tema,
// nome, sons, prêmios) usadas pela página de TV deslogada.
export const publicGetSalesGoalRankingSettings = base
  .route({
    method: "GET",
    summary: "Configurações do ranking (público)",
    tags: ["ranking"],
  })
  .input(z.object({ orgSlug: z.string().min(1) }))
  .handler(async ({ input, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { slug: input.orgSlug },
      select: { id: true },
    });

    if (!org) {
      throw errors.NOT_FOUND({ message: "Organização não encontrada!" });
    }

    return resolveSalesGoalRankingSettings(org.id);
  });
