import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

// Leitura livre pra qualquer membro (o widget de tabela precisa buscar as
// metas pra calcular Vl.meta/%Meta) — só criar/editar/apagar é admin-only.
export const listDashboardSalesGoals = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar metas de vendas do dashboard",
    tags: ["dashboard-widgets"],
  })
  .input(z.object({ year: z.number().int().optional() }))
  .handler(async ({ input, context }) => {
    const goals = await prisma.dashboardSalesGoal.findMany({
      where: {
        organizationId: context.org.id,
        ...(input.year ? { year: input.year } : {}),
      },
      orderBy: [
        { year: "desc" },
        { month: "desc" },
        { scope: "asc" },
        { label: "asc" },
      ],
      include: { updatedBy: { select: { user: { select: { name: true } } } } },
    });

    return {
      goals: goals.map((goal) => ({
        id: goal.id,
        scope: goal.scope,
        scopeCode: goal.scopeCode,
        label: goal.label,
        year: goal.year,
        month: goal.month,
        value: Number(goal.value),
        updatedByName: goal.updatedBy?.user.name ?? null,
        updatedAt: goal.updatedAt.toISOString(),
      })),
    };
  });
