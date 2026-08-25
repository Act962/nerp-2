import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import z from "zod";

// Rota pública (sem requireAuth): retorna os pedidos do garçom (attendantId)
// dentro da org (orgSlug). Inclui arquivados das últimas N horas para alimentar
// a aba "Concluídos" sem inchar o payload.
export const publicListForAttendant = base
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
          createdAt: z.string(),
          columnEnteredAt: z.string(),
          archivedAt: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { slug: input.orgSlug },
      select: { id: true, name: true },
    });

    if (!org) {
      throw errors.NOT_FOUND({ message: "Organização não encontrada!" });
    }

    const sinceHours = input.sinceHours ?? 24;
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

    const orders = await prisma.kitchenOrder.findMany({
      where: {
        organizationId: org.id,
        attendantId: input.attendantId,
        createdAt: { gte: since },
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
        createdAt: o.createdAt.toISOString(),
        columnEnteredAt: o.columnEnteredAt.toISOString(),
        archivedAt: o.archivedAt ? o.archivedAt.toISOString() : null,
      })),
    };
  });
