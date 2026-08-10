import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { PaymentMethod, SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import z from "zod";

export const createSale = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Criar uma venda",
    tags: ["sales"],
  })
  .input(
    z.object({
      customerId: z.string().optional(),
      subtotal: z.number(),
      discount: z.number(),
      total: z.number(),
      status: z.enum(SaleStatus),
      // Pagamento por forma. Uma forma só = array de um item; várias = misto.
      payments: z
        .array(
          z.object({
            method: z.enum(PaymentMethod),
            amount: z.number().positive(),
          }),
        )
        .min(1),
      items: z.array(
        z.object({
          productId: z.string(),
          productName: z.string(),
          unitPrice: z.number(),
          quantity: z.number(),
        }),
      ),
    }),
  )
  .output(
    z.object({
      saleNumber: z.number(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    const orgId = context.org.id;

    // Venda só entra numa sessão de caixa aberta do operador. Sem isso não há
    // gaveta para registrar o dinheiro nem controle de fechamento.
    const member = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: context.user.id },
      select: { id: true },
    });
    if (!member)
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });

    const session = await prisma.cashSession.findFirst({
      where: { organizationId: orgId, memberId: member.id, status: "OPEN" },
      select: { id: true },
    });
    if (!session)
      throw errors.FORBIDDEN({
        message: "Nenhum caixa aberto. Abra o caixa antes de vender.",
      });

    // Produtos da venda revalidados contra a org, com o estoque atual para a
    // baixa e o movimento de auditoria.
    const products = await prisma.product.findMany({
      where: {
        id: { in: input.items.map((item) => item.productId) },
        organizationId: orgId,
      },
      select: { id: true, currentStock: true, trackStock: true },
    });
    const productById = new Map(
      products.map((product) => [product.id, product]),
    );
    for (const item of input.items) {
      if (!productById.has(item.productId))
        throw errors.NOT_FOUND({
          message: `Produto ${item.productName} não encontrado nesta organização`,
        });
    }

    // A soma das formas de pagamento tem de bater com o total (tolerância de 1
    // centavo para arredondamento). A forma predominante vira o resumo rápido.
    const paidTotal = input.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );
    if (Math.abs(paidTotal - input.total) > 0.01)
      throw errors.BAD_REQUEST({
        message: "A soma dos pagamentos deve ser igual ao total da venda",
      });
    const dominantMethod = [...input.payments].sort(
      (a, b) => b.amount - a.amount,
    )[0].method;

    const saleNumber = await prisma.$transaction(async (tx) => {
      // Numeração atômica por org (substitui o `count()` sujeito a corrida).
      const org = await tx.organization.update({
        where: { id: orgId },
        data: { lastSaleNumber: { increment: 1 } },
        select: { lastSaleNumber: true },
      });
      const nextNumber = org.lastSaleNumber;

      const sale = await tx.sale.create({
        data: {
          organizationId: orgId,
          customerId: input.customerId,
          cashSessionId: session.id,
          createdById: context.user.id,
          paymentMethod: dominantMethod,
          subtotal: input.subtotal,
          discount: input.discount,
          total: input.total,
          saleNumber: nextNumber,
          status: input.status,
          paidAt: input.status === "COMPLETED" ? new Date() : null,
          completedAt: input.status === "COMPLETED" ? new Date() : null,
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
          // Detalhe por forma — fonte de verdade para relatórios de pagamento.
          payments: {
            createMany: {
              data: input.payments.map((payment) => ({
                method: payment.method,
                amount: payment.amount,
              })),
            },
          },
        },
        select: { id: true, saleNumber: true },
      });

      // Baixa de estoque + movimento de auditoria (só para produtos que
      // controlam estoque).
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
            saleId: sale.id,
            createdById: context.user.id,
          },
        });
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: newStock },
        });
      }

      // Um movimento de caixa POR forma: só as parcelas em DINHEIRO afetam a
      // gaveta física; cartão/PIX entram no total da sessão, não na gaveta.
      for (const payment of input.payments) {
        await tx.cashMovement.create({
          data: {
            organizationId: orgId,
            sessionId: session.id,
            type: "VENDA",
            amount: payment.amount,
            paymentMethod: payment.method,
            saleId: sale.id,
            description: `Venda #${sale.saleNumber}`,
            createdById: context.user.id,
          },
        });
      }

      return sale.saleNumber;
    });

    return { saleNumber };
  });
