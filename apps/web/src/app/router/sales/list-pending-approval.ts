import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { SaleStatus } from "@/generated/prisma/enums";
import { z } from "zod";

// Fila de pedidos do Catálogo Online aguardando aprovação no PDV.
// Usada pelo botão "X novos pedidos" no header do /vendas/novo.
export const listPendingApproval = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .output(
    z.object({
      count: z.number(),
      orders: z.array(
        z.object({
          id: z.string(),
          saleNumber: z.number(),
          customerName: z.string().nullable(),
          total: z.number(),
          itemsCount: z.number(),
          createdAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const orders = await prisma.sale.findMany({
      where: {
        organizationId: context.org.id,
        status: SaleStatus.PENDING_APPROVAL,
      },
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      count: orders.length,
      orders: orders.map((order) => ({
        id: order.id,
        saleNumber: order.saleNumber,
        customerName: order.customer?.name ?? null,
        total: Number(order.total),
        itemsCount: order._count.items,
        createdAt: order.createdAt.toISOString(),
      })),
    };
  });
