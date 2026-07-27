import z from "zod";
import { base } from "@/app/middlewares/base";
import {
  buildCollaboratorPhotoMap,
  normalizeCollaboratorName,
} from "@/features/ranking/lib/collaborator-name-match";
import prisma from "@/lib/db";
import { buildSalesGoalRanking } from "./_ranking-data";
import { periodTypeSchema, salesModeSchema } from "./_schemas";

// Rota pública (sem requireAuth): ranking da org identificada pelo slug, para
// a página de TV deslogada — mesmo modelo do painel do garçom. Só leitura: não
// expõe memberId nem branches inativas. A foto do vendedor é resolvida aqui
// (fallback pelo nome do colaborador) porque a tela pública não pode consultar
// a lista de colaboradores, que é autenticada.
//
// O payload público é montado por ALLOWLIST, campo a campo, e não por "spread
// menos o que é sensível". A diferença não é estilo: `buildSalesGoalRanking` é
// compartilhado com a rota autenticada, então todo campo novo que nascer lá
// apareceria aqui sozinho. Foi exatamente assim que custo e margem por vendedor
// vazaram para esta rota quando as métricas de ERP foram adicionadas.
//
// NUNCA exponha aqui: custo, margem, ou qualquer coisa derivada de
// `VLCUSTOREAL`. É estrutura de custo do cliente, e esta URL não pede login.
export const publicListSalesGoalRanking = base
  .route({
    method: "GET",
    summary: "Ranking de metas do período (público)",
    tags: ["ranking"],
  })
  .input(
    z.object({
      orgSlug: z.string().min(1),
      periodType: periodTypeSchema,
      periodStart: z.string().optional(),
      salesMode: salesModeSchema.optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { slug: input.orgSlug },
      select: { id: true },
    });

    if (!org) {
      throw errors.NOT_FOUND({ message: "Organização não encontrada!" });
    }

    const period = await buildSalesGoalRanking(org.id, {
      periodType: input.periodType,
      periodStart: input.periodStart,
      salesMode: input.salesMode,
    });

    if (!period) return null;

    const collaborators = await prisma.collaborator.findMany({
      where: { organizationId: org.id, isActive: true },
      select: { name: true, photoUrl: true },
    });
    const photoByName = buildCollaboratorPhotoMap(collaborators);

    return {
      id: period.id,
      periodType: period.periodType,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      label: period.label,
      goalTotal: period.goalTotal,
      achievedTotal: period.achievedTotal,
      // Ritmo e projeção derivam de meta, vendido e datas — tudo já público.
      pace: period.pace,
      projectedTotal: period.projectedTotal,
      projectedPercent: period.projectedPercent,
      // Origem do vendido: só "ERP"/"NATIVE" (não revela dado sensível). Sem
      // isso a tela de TV não sabe que é ERP e o seletor Faturado/Pipeline —
      // que o board só mostra quando a origem é ERP — nunca apareceria aqui.
      achievedSourceKind: period.achievedSourceKind,
      // Recorte ativo + totais dos dois recortes: são só valores de venda
      // (não custo/margem), então podem sair no payload público — a tela de TV
      // também tem o seletor Faturado/Pipeline.
      salesMode: period.salesMode,
      invoicedTotal: period.invoicedTotal,
      pipelineTotal: period.pipelineTotal,
      branches: period.branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        isActive: branch.isActive,
        goalTotal: branch.goalTotal,
        achievedTotal: branch.achievedTotal,
        entries: branch.entries.map((entry) => ({
          id: entry.id,
          externalCode: entry.externalCode,
          goalName: entry.goalName,
          sellerName: entry.sellerName,
          entryKind: entry.entryKind,
          goalAmount: entry.goalAmount,
          achievedAmount: entry.achievedAmount,
          percentAchieved: entry.percentAchieved,
          remainingAmount: entry.remainingAmount,
          achievedSource: entry.achievedSource,
          projectedAmount: entry.projectedAmount,
          projectedPercent: entry.projectedPercent,
          photoUrl:
            entry.photoUrl ??
            photoByName.get(normalizeCollaboratorName(entry.sellerName)) ??
            null,
        })),
      })),
    };
  });
