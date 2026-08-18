import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { resolveSalesGoalRankingSettings } from "../_ranking-data";

export const getSalesGoalRankingSettings = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Configurações do ranking da organização",
    tags: ["ranking"],
  })
  .input(z.object({}).optional())
  .handler(({ context }) => resolveSalesGoalRankingSettings(context.org.id));
