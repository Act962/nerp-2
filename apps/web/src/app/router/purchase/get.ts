import { ProductUnit, PurchaseStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { z } from "zod";
import { getPurchaseAccess } from "./_access";
import { p } from "./_shared";

export const getPurchase = p
  .input(z.object({ id: z.string() }))
  .output(
    z.object({
      id: z.string(),
      purchaseNumber: z.number(),
      invoiceNumber: z.string().nullable(),
      supplierId: z.string().nullable(),
      supplierName: z.string().nullable(),
      status: z.enum(PurchaseStatus),
      subtotal: z.number(),
      /** Só o desconto de cabeçalho — os das linhas vêm em cada item. */
      discount: z.number(),
      shipping: z.number(),
      total: z.number(),
      installments: z.number(),
      firstDueDate: z.string().nullable(),
      orderDate: z.string(),
      receivedDate: z.string().nullable(),
      notes: z.string().nullable(),
      items: z.array(
        z.object({
          productId: z.string(),
          productName: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
          discount: z.number(),
          total: z.number(),
          newSalePrice: z.number().nullable(),
          // Estado ATUAL do produto — é com isto que a tela calcula a
          // sugestão de preço e mostra o impacto no estoque.
          product: z.object({
            sku: z.string().nullable(),
            barcode: z.string().nullable(),
            unit: z.enum(ProductUnit),
            costPrice: z.number(),
            salePrice: z.number(),
            currentStock: z.number(),
            trackStock: z.boolean(),
          }),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const access = await getPurchaseAccess(context.org.id, context.user.id);
    if (!access.canManage) {
      throw errors.FORBIDDEN({
        message: "Você não tem acesso às entradas de nota",
      });
    }

    const purchase = await prisma.purchase.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: {
        id: true,
        purchaseNumber: true,
        invoiceNumber: true,
        supplierId: true,
        status: true,
        subtotal: true,
        discount: true,
        shipping: true,
        total: true,
        installments: true,
        firstDueDate: true,
        orderDate: true,
        receivedDate: true,
        notes: true,
        supplier: { select: { name: true } },
        items: {
          orderBy: { sortOrder: "asc" },
          select: {
            productId: true,
            productName: true,
            quantity: true,
            unitPrice: true,
            discount: true,
            total: true,
            newSalePrice: true,
            product: {
              select: {
                sku: true,
                barcode: true,
                unit: true,
                costPrice: true,
                salePrice: true,
                currentStock: true,
                trackStock: true,
              },
            },
          },
        },
      },
    });
    if (!purchase) {
      throw errors.NOT_FOUND({ message: "Entrada não encontrada" });
    }

    const itemsDiscount = purchase.items.reduce(
      (sum, item) => sum + item.discount.toNumber(),
      0,
    );

    return {
      id: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      invoiceNumber: purchase.invoiceNumber,
      supplierId: purchase.supplierId,
      supplierName: purchase.supplier?.name ?? null,
      status: purchase.status,
      subtotal: purchase.subtotal.toNumber(),
      // `Purchase.discount` guarda linhas + cabeçalho, para o documento fechar
      // sozinho. A tela edita só a parte de cabeçalho, então devolvemos ela.
      discount: Math.max(
        0,
        Math.round((purchase.discount.toNumber() - itemsDiscount) * 100) / 100,
      ),
      shipping: purchase.shipping.toNumber(),
      total: purchase.total.toNumber(),
      installments: purchase.installments,
      firstDueDate: purchase.firstDueDate?.toISOString() ?? null,
      orderDate: purchase.orderDate.toISOString(),
      receivedDate: purchase.receivedDate?.toISOString() ?? null,
      notes: purchase.notes,
      items: purchase.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        discount: item.discount.toNumber(),
        total: item.total.toNumber(),
        newSalePrice: item.newSalePrice?.toNumber() ?? null,
        product: {
          sku: item.product.sku,
          barcode: item.product.barcode,
          unit: item.product.unit,
          costPrice: item.product.costPrice.toNumber(),
          salePrice: item.product.salePrice.toNumber(),
          currentStock: item.product.currentStock.toNumber(),
          trackStock: item.product.trackStock,
        },
      })),
    };
  });
