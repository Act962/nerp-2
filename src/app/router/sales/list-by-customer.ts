import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { PaymentMethod, SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import z from "zod";

// Vendas de UM cliente + resumo (KPI cards) + filtro de período. Alimenta o
// popup "Histórico de vendas do cliente" (Alt+C → Ver histórico). Retorna a
// venda com ITENS e PAGAMENTOS já incluídos — a UI expande a linha sem uma
// segunda ida ao server. Multi-tenant: filtra por organizationId e valida
// que o customerId pertence à org antes de listar.
export const listSalesByCustomer = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      customerId: z.string(),
      // Filtro por data da venda (ISO). `to` é inclusivo até o fim do dia.
      from: z.string().optional(),
      to: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
  )
  .output(
    z.object({
      summary: z.object({
        salesCount: z.number(),
        totalSpent: z.number(),
        averageTicket: z.number(),
        lastSaleAt: z.string().nullable(),
      }),
      sales: z.array(
        z.object({
          id: z.string(),
          saleNumber: z.number(),
          status: z.enum(SaleStatus),
          createdAt: z.string(),
          subtotal: z.number(),
          discount: z.number(),
          total: z.number(),
          itemsCount: z.number(),
          items: z.array(
            z.object({
              id: z.string(),
              productName: z.string(),
              sku: z.string().nullable(),
              unit: z.string(),
              quantity: z.number(),
              unitPrice: z.number(),
              total: z.number(),
            }),
          ),
          payments: z.array(
            z.object({
              method: z.enum(PaymentMethod),
              amount: z.number(),
            }),
          ),
          // Forma predominante (persistida em Sale.paymentMethod) — usada no
          // resumo rápido quando não há pagamentos detalhados.
          paymentMethod: z.enum(PaymentMethod).nullable(),
        }),
      ),
      nextCursor: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // Re-valida o cliente na org (evita ler dados de outra org via id enviado).
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!customer)
      throw errors.NOT_FOUND({ message: "Cliente não encontrado" });

    const take = input.limit ?? 20;
    const toEnd = input.to
      ? new Date(new Date(input.to).getTime() + 24 * 60 * 60 * 1000 - 1)
      : undefined;

    const where = {
      organizationId: context.org.id,
      customerId: input.customerId,
      // Considera só vendas efetivadas no resumo/lista — DRAFT/CANCELLED
      // poluíriam o histórico. Cancelamento explícito ainda aparece (ver nota).
      status: {
        in: [
          SaleStatus.COMPLETED,
          SaleStatus.CONFIRMED,
          SaleStatus.PROCESSING,
          SaleStatus.CANCELLED,
        ],
      },
      ...(input.from || toEnd
        ? {
            createdAt: {
              ...(input.from ? { gte: new Date(input.from) } : {}),
              ...(toEnd ? { lte: toEnd } : {}),
            },
          }
        : {}),
    };

    const [rows, aggregate, salesCount] = await Promise.all([
      prisma.sale.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: take + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          items: { include: { product: true } },
          payments: true,
        },
      }),
      // Resumo (KPIs) ignora cancelamentos — soma só o que entrou no caixa.
      prisma.sale.aggregate({
        where: {
          ...where,
          status: { in: [SaleStatus.COMPLETED, SaleStatus.CONFIRMED] },
        },
        _sum: { total: true },
        _avg: { total: true },
        _max: { createdAt: true },
      }),
      prisma.sale.count({
        where: {
          ...where,
          status: { in: [SaleStatus.COMPLETED, SaleStatus.CONFIRMED] },
        },
      }),
    ]);

    const nextCursor = rows.length > take ? rows[take].id : null;
    const sales = rows.slice(0, take).map((row) => ({
      id: row.id,
      saleNumber: row.saleNumber,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      subtotal: Number(row.subtotal),
      discount: Number(row.discount),
      total: Number(row.total),
      itemsCount: row.items.length,
      items: row.items.map((item) => ({
        id: item.id,
        productName: item.product?.name ?? item.productName,
        sku: item.product?.sku ?? null,
        unit: item.product?.unit ?? "UN",
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
      payments: row.payments.map((payment) => ({
        method: payment.method,
        amount: Number(payment.amount),
      })),
      paymentMethod: row.paymentMethod,
    }));

    return {
      summary: {
        salesCount,
        totalSpent: Number(aggregate._sum.total ?? 0),
        averageTicket: Number(aggregate._avg.total ?? 0),
        lastSaleAt: aggregate._max.createdAt?.toISOString() ?? null,
      },
      sales,
      nextCursor,
    };
  });
