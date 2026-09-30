import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  ValorCombinadoInvalido,
  distribuirValorCombinado,
} from "@/features/orbita-orders/lib/valor-combinado";
import { SaleOrigin, SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { z } from "zod";

/**
 * O valor combinado de um pedido de orçamento, vindo do Órbita.
 *
 * O cliente mandou só a lista (catálogo sem preço); o consultor negociou e
 * aqui o NERP passa a saber quanto a venda vale — antes da cobrança, para o
 * acompanhamento do cliente mostrar o valor e o pagamento bater com a venda.
 * Pode ser chamado de novo enquanto a venda está pendente: renegociar vale.
 */
export const updateCatalogOrderQuote = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Valor combinado de um pedido de orçamento do Catálogo",
    tags: ["catalog-order"],
  })
  .input(
    z.object({
      saleId: z.string().min(1),
      /** Total combinado. Sem `items`, é rateado entre os itens. */
      total: z.number().positive().optional(),
      /** Preço combinado de cada produto do pedido. */
      items: z
        .array(
          z.object({
            productId: z.string().min(1),
            unitPrice: z.number().nonnegative(),
          }),
        )
        .optional(),
      shipping: z.number().nonnegative().optional(),
    }),
  )
  .output(z.object({ ok: z.literal(true), total: z.number() }))
  .handler(async ({ input, context, errors }) => {
    if (!context.isS2S) {
      throw errors.FORBIDDEN({
        message: "Só a integração com o Órbita define o valor do orçamento.",
      });
    }

    const venda = await prisma.sale.findFirst({
      where: {
        id: input.saleId,
        organizationId: context.org.id,
        origin: SaleOrigin.CATALOGO_ORBITA,
      },
      select: {
        id: true,
        status: true,
        quoteRequested: true,
        items: { select: { id: true, productId: true, quantity: true } },
      },
    });
    if (!venda) {
      throw errors.NOT_FOUND({ message: "Pedido não encontrado." });
    }
    if (!venda.quoteRequested) {
      throw errors.BAD_REQUEST({
        message: "Este pedido já nasceu com preço; não é um orçamento.",
      });
    }
    if (venda.status !== SaleStatus.PENDING_APPROVAL) {
      throw errors.BAD_REQUEST({
        message: `Pedido já está ${venda.status}; o valor não muda mais.`,
      });
    }

    let precificado: ReturnType<typeof distribuirValorCombinado>;
    try {
      precificado = distribuirValorCombinado(
        venda.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          quantity: Number(item.quantity),
        })),
        { total: input.total, items: input.items },
      );
    } catch (erro) {
      if (erro instanceof ValorCombinadoInvalido) {
        throw errors.BAD_REQUEST({ message: erro.message });
      }
      throw erro;
    }

    const frete = input.shipping ?? 0;
    const aplicado = await prisma.$transaction(async (tx) => {
      // Condicional no status, e antes dos itens: se o pagamento confirmou no
      // meio, nada é reescrito — itens e total nunca ficam de negociações
      // diferentes.
      const atualizada = await tx.sale.updateMany({
        where: {
          id: venda.id,
          organizationId: context.org.id,
          status: SaleStatus.PENDING_APPROVAL,
        },
        data: {
          subtotal: precificado.total,
          shipping: frete,
          total: precificado.total + frete,
          quotedAt: new Date(),
        },
      });
      if (atualizada.count === 0) return false;
      for (const item of precificado.itens) {
        await tx.saleItem.update({
          where: { id: item.id },
          data: { unitPrice: item.unitPrice, total: item.total },
        });
      }
      return true;
    });
    if (!aplicado) {
      throw errors.BAD_REQUEST({
        message: "O pedido mudou de status; o valor não foi aplicado.",
      });
    }

    return { ok: true as const, total: precificado.total + frete };
  });
