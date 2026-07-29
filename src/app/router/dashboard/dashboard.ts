import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { MovementType, SaleStatus } from "@/generated/prisma/enums";
import { z } from "zod";

export const listDashboard = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/dashboard",
    summary: "list dashboard",
  })

  .input(z.object({}))

  .output(
    z.object({
      salesTotal: z.number(),
      totalSinceLastMonth: z.number(),
      productsActive: z.number(),
      productAddedToday: z.number(),
      productsLowStock: z.number(),
      lowStockFromYesterdayToToday: z.number(),
      salesToday: z.number(),
      salesFromYesterdayToToday: z.number(),
      latestSales: z.array(
        z.object({
          id: z.string(),
          createdAt: z.date(),
          quantity: z.number(),
          previousStock: z.number(),
          newStock: z.number(),
          notes: z.string().nullable(),
          total: z.number(),
          status: z.custom<SaleStatus>(),
          product: z.object({
            id: z.string(),
            name: z.string(),
            sku: z.string().nullable(),
            createdAt: z.date(),
          }),
          customer: z.object({
            id: z.string(),
            name: z.string(),
          }),
        }),
      ),
      productWithLowStock: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          sku: z.string().nullable(),
          stock: z.number(),
          stockMin: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ errors, context, input }) => {
    const organizationId = context.org.id;

    // Define o intervalo de datas
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const startOfYesterday = new Date();
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);

    const endOfYesterday = new Date();
    endOfYesterday.setDate(endOfYesterday.getDate() - 1);
    endOfYesterday.setHours(23, 59, 59, 999);

    const startOfMonthAgo = new Date();
    startOfMonthAgo.setMonth(startOfMonthAgo.getMonth() - 1);
    startOfMonthAgo.setHours(0, 0, 0, 0);

    const endOfMonthAgo = new Date();
    endOfMonthAgo.setMonth(endOfMonthAgo.getMonth() - 1);
    endOfMonthAgo.setHours(23, 59, 59, 999);

    // 1. Total de vendas no período
    const salesTotalQuery = await prisma.sale.findMany({
      where: {
        organizationId,
        status: SaleStatus.CONFIRMED,
      },
    });

    const salesTotalSum = salesTotalQuery.reduce(
      (acc, sale) => acc + sale.total.toNumber(),
      0,
    );

    const totalSinceLastMonth = await prisma.sale.findMany({
      where: {
        organizationId,
        status: SaleStatus.CONFIRMED,
        createdAt: {
          gte: startOfMonthAgo,
          lte: endOfMonthAgo,
        },
      },
    });

    const salesTotalSinceLastMonthSum = totalSinceLastMonth.reduce(
      (acc, sale) => acc + sale.total.toNumber(),
      0,
    );

    // 2. Produtos ativos
    const productsActive = await prisma.product.count({
      where: {
        organizationId,
        isActive: true,
      },
    });

    const productAddedToday = await prisma.product.count({
      where: {
        organizationId,
        createdAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });

    // 3. Produtos com estoque baixo
    const productsLowStock = await prisma.product.count({
      where: {
        organizationId,
        isActive: true,
        trackStock: true,
        currentStock: {
          lte: prisma.product.fields.minStock,
        },
      },
    });

    const StockFromYesterdayToToday = await prisma.product.count({
      where: {
        organizationId,
        isActive: true,
        trackStock: true,
        currentStock: {
          lte: prisma.product.fields.minStock,
        },
        createdAt: {
          gte: startOfYesterday,
          lte: endOfYesterday,
        },
      },
    });

    const lowStockFromYesterdayToToday =
      StockFromYesterdayToToday - productsLowStock;

    // 4. Vendas de hoje
    const salesToday = await prisma.sale.count({
      where: {
        organizationId,
        status: SaleStatus.CONFIRMED,
        createdAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });

    const salesFromYesterday = await prisma.sale.count({
      where: {
        organizationId,
        status: SaleStatus.CONFIRMED,
        createdAt: {
          gte: startOfYesterday,
          lte: endOfYesterday,
        },
      },
    });

    const salesFromYesterdayToToday = salesToday - salesFromYesterday;

    // 5. Últimas vendas (movimentações de estoque do tipo VENDA)
    const latestSalesData = await prisma.stockMovement.findMany({
      where: {
        organizationId,
        type: MovementType.VENDA,
        sale: {
          status: SaleStatus.CONFIRMED,
          customerId: {
            not: null,
          },
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            createdAt: true,
          },
        },
        sale: {
          select: {
            id: true,
            status: true,
            total: true,
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    // Formatar as últimas vendas
    const latestSales = latestSalesData
      .filter((movement) => movement.sale?.customer) // Filtrar apenas vendas com cliente
      .map((movement) => ({
        id: movement.id,
        createdAt: movement.createdAt,
        quantity: movement.quantity.toNumber(),
        previousStock: movement.previousStock.toNumber(),
        newStock: movement.newStock.toNumber(),
        status: movement.sale!.status,
        notes: movement.notes,
        total: movement.sale!.total.toNumber(),
        product: {
          id: movement.product.id,
          name: movement.product.name,
          sku: movement.product.sku,
          status: movement.sale!.status,
          createdAt: movement.product.createdAt,
        },
        customer: {
          id: movement.sale!.customer!.id,
          name: movement.sale!.customer!.name,
        },
      }));

    // 6. Produtos com estoque baixo (detalhados)
    const productWithLowStockData = await prisma.product.findMany({
      where: {
        organizationId,
        isActive: true,
        trackStock: true,
        currentStock: {
          lte: prisma.product.fields.minStock,
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minStock: true,
      },
      orderBy: {
        currentStock: "asc",
      },
      take: 10,
    });

    const productWithLowStock = productWithLowStockData.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      stock: product.currentStock.toNumber(),
      stockMin: product.minStock.toNumber(),
    }));

    return {
      salesTotal: salesTotalSum,
      totalSinceLastMonth: salesTotalSinceLastMonthSum,
      productsActive,
      productAddedToday,
      productsLowStock,
      lowStockFromYesterdayToToday,
      salesToday,
      salesFromYesterdayToToday,
      latestSales,
      productWithLowStock,
    };
  });
