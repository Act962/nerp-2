import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  CATALOG_ORIGINS,
  CATALOG_STATUS_GROUPS,
  closureFromNotes,
  isCatalogOrigin,
  statusesOfGroup,
} from "@/features/pedidos/utils/catalog-order-status";
import type { Prisma } from "@/generated/prisma/client";
import { PaymentMethod, SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { z } from "zod";

const DEFAULT_PAGE_SIZE = 30;

/**
 * Pedidos que entraram pelo Catálogo Online, de todos os modos — a aba
 * "Catálogo online" do /pedidos. Venda de balcão (origin PDV) fica de fora.
 */
export const listCatalogOrders = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar pedidos do Catálogo Online",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      status: z.enum(CATALOG_STATUS_GROUPS).optional(),
      origin: z.enum(CATALOG_ORIGINS).optional(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
    }),
  )
  .output(
    z.object({
      orders: z.array(
        z.object({
          id: z.string(),
          saleNumber: z.number(),
          origin: z.enum(CATALOG_ORIGINS),
          status: z.enum(SaleStatus),
          createdAt: z.string(),
          customerName: z.string().nullable(),
          customerPhone: z.string().nullable(),
          items: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              quantity: z.number(),
              unitPrice: z.number(),
              total: z.number(),
            }),
          ),
          total: z.number(),
          shipping: z.number(),
          paymentMethod: z.enum(PaymentMethod).nullable(),
          notes: z.string().nullable(),
          closure: z
            .discriminatedUnion("kind", [
              z.object({ kind: z.literal("APPROVED_AT_PDV") }),
              z.object({ kind: z.literal("REJECTED"), reason: z.string() }),
            ])
            .nullable(),
          orbitaPortalUrl: z.string().nullable(),
        }),
      ),
      nextCursor: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const where: Prisma.SaleWhereInput = {
      organizationId: context.org.id,
      origin: input.origin ?? { in: [...CATALOG_ORIGINS] },
      ...(input.status
        ? { status: { in: statusesOfGroup(input.status) } }
        : {}),
    };

    const rows = await prisma.sale.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        saleNumber: true,
        origin: true,
        status: true,
        createdAt: true,
        total: true,
        shipping: true,
        paymentMethod: true,
        notes: true,
        orbitaPortalUrl: true,
        customer: { select: { name: true, phone: true } },
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            unitPrice: true,
            total: true,
          },
        },
      },
    });

    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;

    return {
      // O `where` já garante origem de catálogo; o guard só estreita o tipo.
      orders: page
        .flatMap(({ origin, ...sale }) =>
          isCatalogOrigin(origin) ? [{ ...sale, origin }] : [],
        )
        .map((sale) => ({
          id: sale.id,
          saleNumber: sale.saleNumber,
          origin: sale.origin,
          status: sale.status,
          createdAt: sale.createdAt.toISOString(),
          customerName: sale.customer?.name ?? null,
          customerPhone: sale.customer?.phone ?? null,
          items: sale.items.map((item) => ({
            id: item.id,
            name: item.productName,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            total: Number(item.total),
          })),
          total: Number(sale.total),
          shipping: Number(sale.shipping),
          paymentMethod: sale.paymentMethod,
          notes: sale.notes,
          closure:
            sale.status === SaleStatus.CANCELLED
              ? closureFromNotes(sale.notes)
              : null,
          orbitaPortalUrl: sale.orbitaPortalUrl,
        })),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  });
