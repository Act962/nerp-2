import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

export const removeDashboardWidget = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Remover um widget do meu dashboard",
    tags: ["dashboard-widgets"],
  })
  .input(z.object({ widgetId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });
    if (!member) {
      throw errors.NOT_FOUND({ message: "Membro não encontrado." });
    }

    const widget = await prisma.dashboardWidget.findFirst({
      where: { id: input.widgetId, memberId: member.id },
      select: { id: true },
    });
    if (!widget) {
      throw errors.NOT_FOUND({ message: "Widget não encontrado." });
    }

    await prisma.dashboardWidget.delete({ where: { id: widget.id } });
    return { deleted: true as const };
  });
