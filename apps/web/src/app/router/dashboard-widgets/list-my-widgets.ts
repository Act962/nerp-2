import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

// Só metadados (o que o membro configurou) — sem valores resolvidos, isso é
// dashboardWidgets.resolveValues, chamado separado pra poder cachear/refazer
// com cadência diferente do layout em si.
export const listMyDashboardWidgets = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar os widgets do meu dashboard",
    tags: ["dashboard-widgets"],
  })
  .input(z.object({}))
  .handler(async ({ context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });
    if (!member) {
      throw errors.NOT_FOUND({ message: "Membro não encontrado." });
    }

    const widgets = await prisma.dashboardWidget.findMany({
      where: { memberId: member.id },
      orderBy: { sortOrder: "asc" },
    });

    return {
      widgets: widgets.map((widget) => ({
        id: widget.id,
        dataSourceKey: widget.dataSourceKey,
        title: widget.title,
        parentId: widget.parentId,
        displayType: widget.displayType,
        chartKind: widget.chartKind,
        color: widget.color,
        icon: widget.icon,
        options: widget.options,
        layout: widget.layout,
        sortOrder: widget.sortOrder,
      })),
    };
  });
