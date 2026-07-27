import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { buildSalesGoalRanking } from "./_ranking-data";
import { periodTypeSchema, salesModeSchema } from "./_schemas";

const listSalesGoalRankingInputSchema = z.object({
  periodType: periodTypeSchema,
  periodStart: z.string().optional(),
  includeInactiveBranches: z.boolean().optional(),
  salesMode: salesModeSchema.optional(),
});

export const listSalesGoalRanking = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Ranking de metas do período",
    tags: ["ranking"],
  })
  .input(listSalesGoalRankingInputSchema)
  .handler(({ input, context }) =>
    buildSalesGoalRanking(context.org.id, input),
  );
