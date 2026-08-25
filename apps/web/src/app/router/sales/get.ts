import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import z from "zod";

export const getSale = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar vendas",
    tags: ["sales"],
  })
  .input(
    z.object({
      saleId: z.string(),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      saleNumber: z.number(),
      status: z.enum(SaleStatus),
      customer: z
        .object({
          name: z.string(),
          document: z.string().nullable(),
          address: z.string().nullable(),
          city: z.string().nullable(),
          state: z.string().nullable(),
        })
        .nullable()
        .optional(),

      items: z.array(
        z.object({
          id: z.string(),
          productName: z.string(),
          sku: z.string().nullable(),
          quantity: z.number(),
          unitPrice: z.number(),
          total: z.number(),
          categoryName: z.string().nullable().optional(),
        }),
      ),
      subtotal: z.number(),
      discount: z.number(),
      total: z.number(),
      icms: z.number().optional(),
      issuedAt: z.date().optional(),
      authorizedAt: z.date().optional(),
      cancelledAt: z.date().optional(),
      cancellationReason: z.string().optional(),
      xmlUrl: z.string().optional(),
      createdAt: z.date(),
      pdfUrl: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const sale = await prisma.sale.findUnique({
      where: {
        id: input.saleId,
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
        customer: true,
      },
    });
    if (!sale) {
      throw new Error("Venda não encontrada");
    }
    const saleFormat = {
      id: sale.id,
      saleNumber: sale.saleNumber,
      status: sale.status,
      customer: sale.customer,
      items: sale.items.map((item) => ({
        id: item.id,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        categoryName: item.product.category?.name,
      })),
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      total: Number(sale.total),
      icms: undefined,
      issuedAt: undefined,
      authorizedAt: undefined,
      cancelledAt: undefined,
      cancellationReason: undefined,
      xmlUrl: undefined,
      createdAt: sale.createdAt,
      pdfUrl: undefined,
    };
    return saleFormat;
  });
