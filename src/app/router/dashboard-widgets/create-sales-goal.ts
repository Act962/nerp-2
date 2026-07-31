import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireOrgAdmin } from "@/lib/org-access";
import prisma from "@/lib/db";

const createSalesGoalInputSchema = z
  .object({
    scope: z.enum(["geral", "supervisor", "usuario"]),
    // Código Winthor (CODSUPERVISOR/CODUSUR) — obrigatório pra escopos que não
    // sejam "geral", pois é ele que casa com o `id` das linhas do relatório
    // Oracle (report-table.ts) na hora de combinar meta x venda real.
    scopeCode: z.string().optional(),
    label: z.string().min(1, "Informe o rótulo da meta"),
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
    value: z.number(),
  })
  .refine((data) => data.scope === "geral" || !!data.scopeCode?.trim(), {
    message: "Informe o código do supervisor/RCA para esse escopo",
    path: ["scopeCode"],
  });

// Meta é identificada por (escopo, código, ano, mês) — criar de novo pro
// mesmo período/escopo SOBRESCREVE o valor em vez de duplicar (upsert), já
// que na prática o admin só quer "lançar a meta de julho" e corrigir depois.
export const createDashboardSalesGoal = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Criar ou atualizar a meta de vendas de um período",
    tags: ["dashboard-widgets"],
  })
  .input(createSalesGoalInputSchema)
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });

    const scopeCode =
      input.scope === "geral" ? "" : (input.scopeCode ?? "").trim();

    const goal = await prisma.dashboardSalesGoal.upsert({
      where: {
        organizationId_scope_scopeCode_year_month: {
          organizationId: context.org.id,
          scope: input.scope,
          scopeCode,
          year: input.year,
          month: input.month,
        },
      },
      create: {
        organizationId: context.org.id,
        scope: input.scope,
        scopeCode,
        label: input.label.trim(),
        year: input.year,
        month: input.month,
        value: input.value,
        updatedById: member?.id,
      },
      update: {
        label: input.label.trim(),
        value: input.value,
        updatedById: member?.id,
      },
      select: { id: true },
    });

    return { id: goal.id };
  });
