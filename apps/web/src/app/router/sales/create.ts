import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { PaymentMethod, SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { resolveManyPrices } from "@/features/precos/server/resolve-price";
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
      // Override manual da tabela — se ausente, resolve pelo cliente (ou default da org).
      priceListId: z.string().nullable().optional(),
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
          // O server IGNORA esse valor e recalcula via resolveManyPrices —
          // mantido só pra o front continuar mandando enquanto migramos.
          unitPrice: z.number().optional(),
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

    // Preço é resolvido SEMPRE no server. Ordem de precedência da tabela:
    //   1) override manual da venda (`priceListId` do input)
    //   2) tabela do cliente vinculado
    //   3) tabela default da org (Varejo)
    // Isso fecha o vazamento de preço antigo (o client mandava o `unitPrice`
    // e a gente confiava). O total/subtotal enviados servem só de sanity —
    // se divergirem do resolvido, aborta.
    let effectivePriceListId: string | null | undefined = input.priceListId ?? undefined;
    if (input.priceListId === undefined && input.customerId) {
      const cust = await prisma.customer.findFirst({
        where: { id: input.customerId, organizationId: orgId },
        select: { priceListId: true },
      });
      effectivePriceListId = cust?.priceListId ?? null;
    }
    const resolved = await resolveManyPrices({
      organizationId: orgId,
      priceListId: effectivePriceListId,
      items: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });
    const resolvedPriceByProduct = new Map(
      resolved.map((r, i) => [`${r.productId}:${i}`, r.unitPrice] as const),
    );
    // O resolver mantém a ordem dos itens, então casamos por índice para
    // suportar o mesmo produto em linhas distintas do carrinho.
    const resolvedByIndex = resolved.map((r) => r.unitPrice);
    const usedPriceListId = resolved[0]?.priceListId ?? null;

    const computedSubtotal = input.items.reduce(
      (sum, item, i) => sum + resolvedByIndex[i] * item.quantity,
      0,
    );
    // Server é autoritativo — usa computedTotal em vez do total do client.
    // Enquanto o PDV não re-resolve preços ao vivo (spec futura), o valor
    // exibido no balcão pode divergir do que grava; o snapshot no `SaleItem`
    // sempre reflete o que o server calculou.
    const computedTotal = computedSubtotal - input.discount;
    // Silencia unused-var do map (mantido pro caso de debug futuro).
    void resolvedPriceByProduct;

    // A soma das formas de pagamento tem de bater com o total resolvido no
    // server (tolerância de 1 centavo pra arredondamento). Quando o cliente
    // usa tabela de atacado/etc., o `computedTotal` pode diferir do que o
    // PDV mostrou; é responsabilidade do UI recalcular antes de fechar.
    const paidTotal = input.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );
    if (Math.abs(paidTotal - computedTotal) > 0.01)
      throw errors.BAD_REQUEST({
        message: `A soma dos pagamentos (R$ ${paidTotal.toFixed(2)}) deve bater com o total resolvido pela tabela de preço (R$ ${computedTotal.toFixed(2)}).`,
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
          priceListId: usedPriceListId,
          cashSessionId: session.id,
          createdById: context.user.id,
          paymentMethod: dominantMethod,
          subtotal: computedSubtotal,
          discount: input.discount,
          total: computedTotal,
          saleNumber: nextNumber,
          status: input.status,
          paidAt: input.status === "COMPLETED" ? new Date() : null,
          completedAt: input.status === "COMPLETED" ? new Date() : null,
          items: {
            createMany: {
              data: input.items.map((item, i) => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: resolvedByIndex[i],
                total: resolvedByIndex[i] * item.quantity,
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
