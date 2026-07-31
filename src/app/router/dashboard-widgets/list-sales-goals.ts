import { z } from "zod";
import prisma from "@/lib/db";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

/**
 * Metas para os widgets do Oracle — PROJEÇÃO, não tabela própria.
 *
 * Existia um `DashboardSalesGoal` separado aqui, digitado à mão. Era uma
 * segunda verdade sobre a mesma coisa: o Ranking já guarda meta por período,
 * com importação de planilha, histórico e o lado "vendido". Duas fontes
 * significavam dois números divergentes para a mesma pergunta.
 *
 * Agora a meta sai SEMPRE de `SalesGoalPeriod` (mensal) e é achatada aqui no
 * formato que `buildGoalsByScope`/`augmentReportTable` já esperam — os
 * templates e o render não mudaram nada.
 *
 * Os três escopos derivam da mesma origem:
 *   • `usuario`    → a meta da entrada, por CODUSUR;
 *   • `supervisor` → soma das metas dos vendedores DAQUELE supervisor, usando
 *     `ExternalSeller.supervisorCode`. Não usa o nome da equipe da planilha
 *     porque ele não bate com o do Winthor ("NORTE" × "PI - NORTE"), enquanto
 *     o código do vendedor é o mesmo dos dois lados;
 *   • `geral`      → o override do período, ou a soma de tudo.
 *
 * Leitura livre para qualquer membro: o widget de tabela precisa dela no
 * cliente para montar as colunas Vl.meta/%Meta.
 */
export const listDashboardSalesGoals = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar metas de vendas (projeção do período do ranking)",
    tags: ["dashboard-widgets"],
  })
  .input(z.object({ year: z.number().int().optional() }))
  .handler(async ({ input, context }) => {
    const periods = await prisma.salesGoalPeriod.findMany({
      where: {
        organizationId: context.org.id,
        periodType: "MONTHLY",
        ...(input.year
          ? {
              periodStart: {
                gte: new Date(Date.UTC(input.year, 0, 1)),
                lt: new Date(Date.UTC(input.year + 1, 0, 1)),
              },
            }
          : {}),
      },
      select: {
        id: true,
        periodStart: true,
        overallGoalAmount: true,
        importedAt: true,
        branches: {
          select: {
            entries: {
              select: {
                externalCode: true,
                sellerName: true,
                goalAmount: true,
              },
            },
          },
        },
      },
    });
    if (periods.length === 0) return { goals: [] };

    // Mapa vendedor → supervisor, para somar a meta por equipe do Winthor.
    const codes = [
      ...new Set(
        periods.flatMap((period) =>
          period.branches.flatMap((branch) =>
            branch.entries.map((entry) => entry.externalCode),
          ),
        ),
      ),
    ];
    const sellers = await prisma.externalSeller.findMany({
      where: { organizationId: context.org.id, externalCode: { in: codes } },
      select: {
        externalCode: true,
        supervisorCode: true,
        supervisorName: true,
      },
    });
    const sellerByCode = new Map(sellers.map((s) => [s.externalCode, s]));

    const goals: {
      id: string;
      scope: string;
      scopeCode: string;
      label: string;
      year: number;
      month: number;
      value: number;
      updatedByName: string | null;
      updatedAt: string;
    }[] = [];

    for (const period of periods) {
      const year = period.periodStart.getUTCFullYear();
      const month = period.periodStart.getUTCMonth() + 1;
      const updatedAt = period.importedAt.toISOString();
      const entries = period.branches.flatMap((branch) => branch.entries);

      const bySupervisor = new Map<string, { label: string; value: number }>();
      let overall = 0;

      for (const entry of entries) {
        const value = Number(entry.goalAmount);
        overall += value;

        goals.push({
          id: `${period.id}:usuario:${entry.externalCode}`,
          scope: "usuario",
          scopeCode: entry.externalCode,
          label: entry.sellerName,
          year,
          month,
          value,
          updatedByName: null,
          updatedAt,
        });

        const seller = sellerByCode.get(entry.externalCode);
        // Vendedor sem supervisor cadastrado não entra na soma por equipe —
        // somar num "sem equipe" inventaria uma linha que o relatório do
        // Oracle nunca vai ter, já que lá o agrupamento é por CODSUPERVISOR.
        if (!seller?.supervisorCode) continue;
        const current = bySupervisor.get(seller.supervisorCode) ?? {
          label: seller.supervisorName?.trim() || seller.supervisorCode,
          value: 0,
        };
        current.value += value;
        bySupervisor.set(seller.supervisorCode, current);
      }

      for (const [code, team] of bySupervisor) {
        goals.push({
          id: `${period.id}:supervisor:${code}`,
          scope: "supervisor",
          scopeCode: code,
          label: team.label,
          year,
          month,
          value: team.value,
          updatedByName: null,
          updatedAt,
        });
      }

      goals.push({
        id: `${period.id}:geral`,
        scope: "geral",
        scopeCode: "",
        label: "Meta geral",
        year,
        month,
        value:
          period.overallGoalAmount !== null
            ? Number(period.overallGoalAmount)
            : overall,
        updatedByName: null,
        updatedAt,
      });
    }

    return { goals };
  });
