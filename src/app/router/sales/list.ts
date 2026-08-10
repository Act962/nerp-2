import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

export const listSales = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar todas as vendas",
    tags: ["sales"],
  })
  .input(
    z.object({
      dateInit: z.date().optional(),
      dateEnd: z.date().optional(),
      methodPayment: z.string().optional(),
      status: z.string().optional(),
      minValue: z.number().optional(),
      maxValue: z.number().optional(),
    }),
  )
  .output(
    z.object({
      sales: z.array(
        z.object({
          id: z.string(),
          saleNumber: z.number(),
          customer: z.string(),
          // customerId separado (nullable) — usado pra abrir o histórico do
          // cliente direto do menu de 3 pontos em /vendas.
          customerId: z.string().nullable(),
          date: z.string(),
          status: z.string(),
          paymentMethod: z.string().nullable(),
          total: z.number(),
          items: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              quantity: z.number(),
              price: z.number(),
            }),
          ),
        }),
      ),
    }),
  )
  .handler(async ({ context, input }) => {
    try {
      const sales = await prisma.sale.findMany({
        where: {
          organizationId: context.org.id,
        },
        include: {
          customer: true,
          items: true,
        },
      });

      const salesResponse = sales.map((sale) => ({
        id: sale.id,
        saleNumber: sale.saleNumber,
        customer: sale.customer?.name || "",
        customerId: sale.customerId,
        date: sale.createdAt.toISOString(),
        status: sale.status,
        paymentMethod: sale.paymentMethod,
        total: Number(sale.total),
        items: sale.items.map((item) => ({
          id: item.id,
          name: item.productName,
          quantity: Number(item.quantity),
          price: Number(item.unitPrice),
        })),
      }));

      return {
        sales: salesResponse,
      };
    } catch (error) {
      throw error;
    }
  });
