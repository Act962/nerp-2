import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { buildAchievedLookup } from "./_sales-aggregation";
import { periodTypeSchema } from "./_schemas";

export const listSalesGoalEvolution = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Evolução de meta x vendido por período",
    tags: ["ranking"],
  })
  .input(z.object({ periodType: periodTypeSchema.optional() }).optional())
  .handler(async ({ input, context }) => {
    const periods = await prisma.salesGoalPeriod.findMany({
      where: {
        organizationId: context.org.id,
        ...(input?.periodType ? { periodType: input.periodType } : {}),
      },
      orderBy: { periodStart: "asc" },
      include: { branches: { include: { entries: true } } },
    });

    const allMemberIds = [
      ...new Set(
        periods
          .flatMap((period) => period.branches)
          .flatMap((branch) => branch.entries)
          .map((entry) => entry.memberId)
          .filter((memberId): memberId is string => memberId !== null),
      ),
    ];

    // Resolve a conexão uma vez e repassa: sem isto cada período refazia o mesmo
    // findUnique da mesma linha.
    const connection = await prisma.erpConnection.findUnique({
      where: { organizationId: context.org.id },
      select: { kind: true },
    });

    return Promise.all(
      periods.map(async (period) => {
        const allEntries = period.branches.flatMap((branch) => branch.entries);
        const lookup = await buildAchievedLookup(
          context.org.id,
          period.periodStart,
          period.periodEnd,
          allMemberIds,
          "INVOICED",
          connection,
        );

        const goalTotal = allEntries.reduce(
          (total, entry) => total + Number(entry.goalAmount),
          0,
        );
        const achievedTotal = allEntries.reduce((total, entry) => {
          const auto = entry.achievedIsManual
            ? null
            : lookup.achievedFor(entry);
          if (auto !== null) return total + auto;
          return (
            total +
            (entry.achievedAmount !== null ? Number(entry.achievedAmount) : 0)
          );
        }, 0);

        return {
          periodId: period.id,
          periodType: period.periodType,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          label: period.label,
          goalTotal,
          achievedTotal,
        };
      }),
    );
  });
