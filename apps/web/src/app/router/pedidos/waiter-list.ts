import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import z from "zod";
import { requireMemberOfOrgSlug } from "./_require-member-of-org-slug";

// Pedidos do garçom (attendantId) dentro da organização do slug. Inclui
// arquivados das últimas N horas para alimentar a aba "Concluídos" sem inchar
// o payload. Exige sessão + vínculo com a organização.
export const waiterListForAttendant = base
  .use(requireAuthMiddleware)
  .route({
    method: "GET",
    summary: "Pedidos do garçom (kiosk)",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      orgSlug: z.string().min(1),
      attendantId: z.string().min(1),
      sinceHours: z.number().int().positive().max(168).optional(),
    }),
  )
  .output(
    z.object({
      orgName: z.string(),
      orders: z.array(
        z.object({
          id: z.string(),
          tableNumber: z.string(),
          dishName: z.string(),
          notes: z.string().nullable(),
          columnId: z.string(),
          columnName: z.string(),
          columnColor: z.string(),
          columnIsInitial: z.boolean(),
          columnIsFinal: z.boolean(),
          columnShowOnTv: z.boolean(),
          estimatedMinutes: z.number().nullable(),
          ticketId: z.string().nullable(),
          createdAt: z.string(),
          columnEnteredAt: z.string(),
          archivedAt: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const org = await requireMemberOfOrgSlug({
      orgSlug: input.orgSlug,
      userId: context.user.id,
      errors,
    });

    const sinceHours = input.sinceHours ?? 24;
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

    const orders = await prisma.kitchenOrder.findMany({
      where: {
        organizationId: org.id,
        attendantId: input.attendantId,
        createdAt: { gte: since },
        // Pedido do cardápio ainda não aceito não é do garçom nem está na
        // cozinha: vive na barra "Novos pedidos" do board.
        acceptedAt: { not: null },
      },
      orderBy: [{ columnEnteredAt: "desc" }, { createdAt: "desc" }],
      include: {
        column: {
          select: {
            name: true,
            color: true,
            isInitial: true,
            isFinal: true,
            showOnTv: true,
          },
        },
      },
    });

    return {
      orgName: org.name,
      orders: orders.map((o) => ({
        id: o.id,
        tableNumber: o.tableNumber,
        dishName: o.dishName,
        notes: o.notes,
        columnId: o.columnId,
        columnName: o.column.name,
        columnColor: o.column.color,
        columnIsInitial: o.column.isInitial,
        columnIsFinal: o.column.isFinal,
        columnShowOnTv: o.column.showOnTv,
        estimatedMinutes: o.estimatedMinutes,
        ticketId: o.ticketId,
        createdAt: o.createdAt.toISOString(),
        columnEnteredAt: o.columnEnteredAt.toISOString(),
        archivedAt: o.archivedAt ? o.archivedAt.toISOString() : null,
      })),
    };
  });
