import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { periodRange, SALES_PERIODS } from "@/features/sales/lib/period-range";
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
      // Recorte pronto ("hoje", "esta semana", "este mês"). O cálculo do
      // intervalo é do SERVIDOR: o fuso da loja é regra de negócio e não pode
      // depender do relógio da máquina de quem abriu a tela.
      period: z.enum(SALES_PERIODS).optional(),
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
    // O período resolve para um intervalo semiaberto; `dateInit`/`dateEnd`
    // explícitos, quando vierem, estreitam ainda mais.
    const range = input.period ? periodRange(input.period) : null;
    const inicio = input.dateInit ?? range?.from;
    const fimExclusivo = range?.to;

    const createdAt =
      inicio || fimExclusivo || input.dateEnd
        ? {
            ...(inicio ? { gte: inicio } : {}),
            ...(fimExclusivo ? { lt: fimExclusivo } : {}),
            ...(input.dateEnd ? { lte: input.dateEnd } : {}),
          }
        : undefined;

    const sales = await prisma.sale.findMany({
      where: {
        organizationId: context.org.id,
        ...(createdAt ? { createdAt } : {}),
      },
      orderBy: { createdAt: "desc" },
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
  });
