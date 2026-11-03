import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { SaleOrigin, SaleStatus } from "@/generated/prisma/enums";
import { z } from "zod";

// Fila de pedidos do Catálogo Online aguardando aprovação no PDV.
// Usada pelo botão "X novos pedidos" no header do /vendas/novo. Pedido do modo
// ORBITA fica de fora: quem confirma ou cancela é o Órbita, não o balcão.
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
        // Orbita tem dono próprio (o Órbita negocia e confirma) e o pedido da
        // Força de Vendas tem o receptor em /vendas/forca-de-vendas: nenhum
        // dos dois entra na fila de aprovação do PDV.
        origin: {
          notIn: [SaleOrigin.CATALOGO_ORBITA, SaleOrigin.FORCA_VENDAS],
        },
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
