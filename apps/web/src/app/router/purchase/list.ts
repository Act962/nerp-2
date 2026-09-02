import { PurchaseStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { z } from "zod";
import { getPurchaseAccess } from "./_access";
import { p } from "./_shared";

const DEFAULT_PAGE_SIZE = 20;

export const listPurchases = p
  .input(
    z.object({
      status: z.enum(PurchaseStatus).optional(),
      supplierId: z.string().optional(),
      /** Casa o número da NF ou o número sequencial da entrada. */
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
    }),
  )
  .output(
    z.object({
      purchases: z.array(
        z.object({
          id: z.string(),
          purchaseNumber: z.number(),
          invoiceNumber: z.string().nullable(),
          supplierName: z.string().nullable(),
          status: z.enum(PurchaseStatus),
          total: z.number(),
          itemCount: z.number(),
          installments: z.number(),
          orderDate: z.string(),
          receivedDate: z.string().nullable(),
        }),
      ),
      totalCount: z.number(),
      page: z.number(),
      pageSize: z.number(),
      totalPages: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const access = await getPurchaseAccess(context.org.id, context.user.id);
    if (!access.canManage) {
      throw errors.FORBIDDEN({
        message: "Você não tem acesso às entradas de nota",
      });
    }

    const search = input.search?.trim();
    const searchNumber = search ? Number(search) : Number.NaN;

    const where = {
      organizationId: context.org.id,
      ...(input.status ? { status: input.status } : {}),
      ...(input.supplierId ? { supplierId: input.supplierId } : {}),
      ...(search
        ? {
            OR: [
              {
                invoiceNumber: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              ...(Number.isInteger(searchNumber)
                ? [{ purchaseNumber: searchNumber }]
                : []),
            ],
          }
        : {}),
    };

    const [rows, totalCount] = await Promise.all([
      prisma.purchase.findMany({
        where,
        orderBy: { purchaseNumber: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: {
          id: true,
          purchaseNumber: true,
          invoiceNumber: true,
          status: true,
          total: true,
          installments: true,
          orderDate: true,
          receivedDate: true,
          supplier: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.purchase.count({ where }),
    ]);

    return {
      purchases: rows.map((row) => ({
        id: row.id,
        purchaseNumber: row.purchaseNumber,
        invoiceNumber: row.invoiceNumber,
        supplierName: row.supplier?.name ?? null,
        status: row.status,
        total: row.total.toNumber(),
        itemCount: row._count.items,
        installments: row.installments,
        orderDate: row.orderDate.toISOString(),
        receivedDate: row.receivedDate?.toISOString() ?? null,
      })),
      totalCount,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / input.pageSize)),
    };
  });
