import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

const gridItemSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

const saveLayoutInputSchema = z.object({
  widgets: z.array(
    z.object({
      widgetId: z.string(),
      layout: z.record(z.string(), gridItemSchema),
      sortOrder: z.number().int(),
    }),
  ),
});

// Salvamento em lote, chamado com debounce (300-500ms) no client após soltar
// o arraste/resize — não uma chamada por tick de movimento. Ids que não são
// deste member são ignorados em silêncio (autosave desatualizado não pode
// corromper o dashboard de outra pessoa nem falhar o lote inteiro).
export const saveDashboardLayout = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Salvar posição/tamanho dos widgets do meu dashboard",
    tags: ["dashboard-widgets"],
  })
  .input(saveLayoutInputSchema)
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });
    if (!member) {
      throw errors.NOT_FOUND({ message: "Membro não encontrado." });
    }

    const ownedIds = new Set(
      (
        await prisma.dashboardWidget.findMany({
          where: { memberId: member.id },
          select: { id: true },
        })
      ).map((widget) => widget.id),
    );

    const updates = input.widgets.filter((widget) =>
      ownedIds.has(widget.widgetId),
    );

    await prisma.$transaction(
      updates.map((widget) =>
        prisma.dashboardWidget.update({
          where: { id: widget.widgetId },
          data: { layout: widget.layout, sortOrder: widget.sortOrder },
        }),
      ),
    );

    return { saved: updates.length };
  });
