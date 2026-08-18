import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import z from "zod";

export const publicReadyOrders = base
  .route({
    method: "GET",
    summary: "Pedidos prontos (painel TV, público)",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      orgSlug: z.string().min(1),
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
          attendantName: z.string().nullable(),
          attendantPhoto: z.string().nullable(),
          readyAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { slug: input.orgSlug },
    });

    if (!org) {
      throw errors.NOT_FOUND({ message: "Organização não encontrada!" });
    }

    // O pedido pronto fica na TV até sair do status de pronto: ou seja, até ser
    // movido p/ fora da coluna showOnTv ou arquivado (retirado). O tempo de espera
    // não remove mais o pedido — mesmo critério "ativo" do board (archivedAt: null).
    const orders = await prisma.kitchenOrder.findMany({
      where: {
        organizationId: org.id,
        column: { showOnTv: true },
        archivedAt: null,
      },
      orderBy: { columnEnteredAt: "desc" },
    });

    return {
      orgName: org.name,
      orders: orders.map((order) => ({
        id: order.id,
        tableNumber: order.tableNumber,
        dishName: order.dishName,
        attendantName: order.attendantName,
        attendantPhoto: order.attendantPhoto,
        readyAt: order.columnEnteredAt.toISOString(),
      })),
    };
  });
