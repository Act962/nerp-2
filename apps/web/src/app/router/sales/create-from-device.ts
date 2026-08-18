import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import { PaymentMethod, SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { z } from "zod";

/**
 * Replay de uma venda feita OFFLINE no device.
 *
 * Diferente de `sales.create` (venda online) em dois pontos deliberados:
 *
 * 1) IDEMPOTENTE por `clientOperationId` (uuid v7 do device). Reenviar a mesma
 *    venda — o normal quando a conexão oscila no meio do drain — devolve a venda
 *    já criada, sem duplicar. O `@unique` cobre a corrida de dois replays.
 *
 * 2) A venda é um FATO CONSUMADO: o dinheiro já foi recebido offline com os
 *    preços que o device tinha em cache. Então o server NÃO re-resolve preço nem
 *    rejeita por divergência (isso é regra de venda online) — grava os preços
 *    capturados. O server só faz o que é dele: atribui o `saleNumber` atômico e
 *    baixa o estoque (permitindo furar — offline é advisório).
 *
 * Escopado por `context.org.id` (org do device), nunca por dado do input.
 */
export const createSaleFromDevice = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      operationId: z.string().min(1),
      customerId: z.string().optional(),
      discount: z.number().min(0).default(0),
      total: z.number(),
      status: z.enum(SaleStatus).default(SaleStatus.COMPLETED),
      soldAt: z.string().optional(), // ISO do momento da venda offline
      payments: z
        .array(
          z.object({
            method: z.enum(PaymentMethod),
            amount: z.number().positive(),
          }),
        )
        .min(1),
      items: z
        .array(
          z.object({
            productId: z.string(),
            productName: z.string(),
            quantity: z.number().positive(),
            unitPrice: z.number().min(0),
          }),
        )
        .min(1),
    }),
  )
  .output(
    z.object({
      saleId: z.string(),
      saleNumber: z.number(),
      // true = já tinha sido processada (replay); a venda não foi recriada.
      duplicate: z.boolean(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    const orgId = context.org.id;

    // Idempotência: já processado?
    const existing = await prisma.sale.findUnique({
      where: { clientOperationId: input.operationId },
      select: { id: true, saleNumber: true, organizationId: true },
    });
    if (existing) {
      if (existing.organizationId !== orgId) throw errors.FORBIDDEN();
      return {
        saleId: existing.id,
        saleNumber: existing.saleNumber,
        duplicate: true,
      };
    }

    // Revalida os produtos contra a org (e pega o estoque para a baixa).
    const products = await prisma.product.findMany({
      where: {
        id: { in: input.items.map((i) => i.productId) },
        organizationId: orgId,
      },
      select: { id: true, currentStock: true, trackStock: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));
    for (const item of input.items) {
      if (!productById.has(item.productId))
        throw errors.NOT_FOUND({
          message: `Produto ${item.productName} não encontrado nesta organização`,
        });
    }

    const subtotal = input.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const dominantMethod = [...input.payments].sort(
      (a, b) => b.amount - a.amount,
    )[0].method;
    const soldAt = input.soldAt ? new Date(input.soldAt) : new Date();

    try {
      const sale = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.update({
          where: { id: orgId },
          data: { lastSaleNumber: { increment: 1 } },
          select: { lastSaleNumber: true },
        });

        const created = await tx.sale.create({
          data: {
            organizationId: orgId,
            clientOperationId: input.operationId,
            customerId: input.customerId,
            createdById: context.user.id,
            paymentMethod: dominantMethod,
            subtotal,
            discount: input.discount,
            total: input.total,
            saleNumber: org.lastSaleNumber,
            status: input.status,
            paidAt: soldAt,
            completedAt: input.status === SaleStatus.COMPLETED ? soldAt : null,
            items: {
              createMany: {
                data: input.items.map((item) => ({
                  productId: item.productId,
                  productName: item.productName,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: item.unitPrice * item.quantity,
                })),
              },
            },
            payments: {
              createMany: {
                data: input.payments.map((p) => ({
                  method: p.method,
                  amount: p.amount,
                })),
              },
            },
          },
          select: { id: true, saleNumber: true },
        });

        // Baixa de estoque — offline é advisório, então PERMITE furar (negativo);
        // a divergência fica registrada no movimento para reconciliação depois.
        for (const item of input.items) {
          const product = productById.get(item.productId);
          if (!product || !product.trackStock) continue;
          const previousStock = Number(product.currentStock);
          const newStock = previousStock - item.quantity;
          await tx.stockMovement.create({
            data: {
              organizationId: orgId,
              productId: item.productId,
              type: "VENDA",
              quantity: item.quantity,
              previousStock,
              newStock,
              saleId: created.id,
              createdById: context.user.id,
            },
          });
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: newStock },
          });
        }

        return created;
      });

      return { saleId: sale.id, saleNumber: sale.saleNumber, duplicate: false };
    } catch (error) {
      // Corrida: outro replay do mesmo operationId criou a venda primeiro.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const winner = await prisma.sale.findUniqueOrThrow({
          where: { clientOperationId: input.operationId },
          select: { id: true, saleNumber: true },
        });
        return {
          saleId: winner.id,
          saleNumber: winner.saleNumber,
          duplicate: true,
        };
      }
      throw error;
    }
  });
