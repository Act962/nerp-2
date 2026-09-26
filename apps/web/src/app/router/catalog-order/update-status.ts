import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { PaymentMethod, SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { applySaleStockOut } from "@/features/sales/server/stock-out";
import { z } from "zod";

const ORBITA_METHOD_TO_PAYMENT_METHOD = {
  PIX: PaymentMethod.PIX,
  CREDIT_CARD: PaymentMethod.CREDITO,
  BOLETO: PaymentMethod.BOLETO,
  OTHER: PaymentMethod.OUTROS,
} as const;

const ORBITA_STATUS_TO_SALE_STATUS = {
  CONFIRMED: SaleStatus.CONFIRMED,
  CANCELED: SaleStatus.CANCELLED,
} as const;

/**
 * Retorno do Órbita sobre um pedido do Catálogo Online (modo ORBITA).
 *
 * Só a integração S2S chama: confirmar aqui baixa estoque e registra um
 * pagamento que ninguém no balcão viu, então sessão de usuário não entra.
 * Idempotente — o Órbita reenvia em retry, e a transição sai de
 * `PENDING_APPROVAL` por `updateMany` condicional, de modo que duas chamadas
 * simultâneas não baixam o estoque em dobro.
 */
export const updateCatalogOrderStatus = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Atualizar status de pedido do Catálogo vindo do Órbita",
    tags: ["catalog-order"],
  })
  .input(
    z.object({
      saleId: z.string().min(1),
      status: z.enum(["CONFIRMED", "CANCELED"]),
      payment: z
        .object({
          method: z.enum(["PIX", "CREDIT_CARD", "BOLETO", "OTHER"]),
          amount: z.number().nonnegative(),
          gatewayPaymentId: z.string().min(1),
          paidAt: z.iso.datetime({ offset: true }),
        })
        .optional(),
    }),
  )
  .output(z.object({ ok: z.literal(true), status: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (!context.isS2S) {
      throw errors.FORBIDDEN({
        message: "Só a integração com o Órbita atualiza pedidos do catálogo.",
      });
    }

    const sale = await prisma.sale.findFirst({
      where: { id: input.saleId, organizationId: context.org.id },
      select: { id: true, status: true, notes: true },
    });
    if (!sale) {
      throw errors.NOT_FOUND({ message: "Pedido não encontrado." });
    }

    const targetStatus = ORBITA_STATUS_TO_SALE_STATUS[input.status];
    if (sale.status === targetStatus) {
      return { ok: true as const, status: sale.status };
    }
    if (sale.status !== SaleStatus.PENDING_APPROVAL) {
      throw errors.BAD_REQUEST({
        message: `Pedido já está ${sale.status} e não pode virar ${targetStatus}.`,
      });
    }

    const now = new Date();

    if (input.status === "CANCELED") {
      const cancelled = await prisma.sale.updateMany({
        where: {
          id: sale.id,
          organizationId: context.org.id,
          status: SaleStatus.PENDING_APPROVAL,
        },
        data: {
          status: SaleStatus.CANCELLED,
          cancelledAt: now,
          notes: `${sale.notes ? `${sale.notes}\n` : ""}Cancelado pelo Órbita.`,
        },
      });
      return {
        ok: true as const,
        status:
          cancelled.count > 0
            ? SaleStatus.CANCELLED
            : await readStatus(sale.id),
      };
    }

    const payment = input.payment;
    const paymentMethod = payment
      ? ORBITA_METHOD_TO_PAYMENT_METHOD[payment.method]
      : null;
    const paymentNote = payment
      ? `Pago via Órbita (${payment.method}, pagamento ${payment.gatewayPaymentId}).`
      : "Confirmado pelo Órbita.";

    const confirmed = await prisma.$transaction(async (tx) => {
      const transitioned = await tx.sale.updateMany({
        where: {
          id: sale.id,
          organizationId: context.org.id,
          status: SaleStatus.PENDING_APPROVAL,
        },
        data: {
          status: SaleStatus.CONFIRMED,
          paymentMethod,
          paidAt: payment ? new Date(payment.paidAt) : now,
          notes: `${sale.notes ? `${sale.notes}\n` : ""}${paymentNote}`,
        },
      });
      if (transitioned.count === 0) return false;

      if (payment && paymentMethod) {
        await tx.salePayment.create({
          data: {
            saleId: sale.id,
            method: paymentMethod,
            amount: payment.amount,
          },
        });
      }

      const items = await tx.saleItem.findMany({
        where: { saleId: sale.id },
        select: { productId: true, quantity: true },
      });
      const products = await tx.product.findMany({
        where: {
          id: { in: items.map((item) => item.productId) },
          organizationId: context.org.id,
        },
        select: { id: true, currentStock: true, trackStock: true },
      });

      await applySaleStockOut(tx, {
        organizationId: context.org.id,
        saleId: sale.id,
        createdById: context.user.id,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
        })),
        productById: new Map(products.map((product) => [product.id, product])),
      });

      return true;
    });

    return {
      ok: true as const,
      status: confirmed ? SaleStatus.CONFIRMED : await readStatus(sale.id),
    };
  });

async function readStatus(saleId: string): Promise<string> {
  const current = await prisma.sale.findUnique({
    where: { id: saleId },
    select: { status: true },
  });
  return current?.status ?? SaleStatus.PENDING_APPROVAL;
}
