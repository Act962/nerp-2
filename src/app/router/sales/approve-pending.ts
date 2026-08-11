import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { PersonType, SaleStatus } from "@/generated/prisma/enums";
import { z } from "zod";

// Aprovar pedido pendente do catálogo:
//   1. Valida que a Sale pertence à org e está PENDING_APPROVAL.
//   2. Devolve os itens (com dados do produto atual: preço, estoque, imagem)
//      para o PDV hidratar o carrinho — assim o operador finaliza a venda
//      pelo fluxo normal (nova Sale, nova numeração, pagamento presencial).
//   3. Marca a Sale pendente como CANCELLED com nota, mantendo histórico.
//      Não deleta pra preservar auditoria de pedidos entrantes.
export const approvePending = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ saleId: z.string() }))
  .output(
    z.object({
      customer: z
        .object({
          id: z.string(),
          name: z.string(),
          document: z.string().nullable(),
          email: z.string().nullable(),
          phone: z.string().nullable(),
          personType: z.enum(PersonType),
        })
        .nullable(),
      items: z.array(
        z.object({
          productId: z.string(),
          name: z.string(),
          sku: z.string().nullable(),
          barcode: z.string().nullable(),
          image: z.string().nullable(),
          salePrice: z.number(),
          costPrice: z.number(),
          currentStock: z.number(),
          minStock: z.number(),
          unit: z.string(),
          isActive: z.boolean(),
          trackStock: z.boolean(),
          quantity: z.number(),
          unitPriceAtRequest: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const sale = await prisma.sale.findFirst({
      where: {
        id: input.saleId,
        organizationId: context.org.id,
        status: SaleStatus.PENDING_APPROVAL,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            document: true,
            email: true,
            phone: true,
            personType: true,
          },
        },
        items: true,
      },
    });

    if (!sale) {
      throw errors.NOT_FOUND({
        message: "Pedido não encontrado ou já foi processado.",
      });
    }

    const productIds = sale.items
      .map((item) => item.productId)
      .filter((id): id is string => Boolean(id));

    // Puxa os produtos atualizados para popular o carrinho. Se algum saiu
    // do catálogo depois do pedido, o operador vê o item sem preço/estoque
    // atualizado — a validação continua no fluxo normal do PDV.
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        organizationId: context.org.id,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        thumbnail: true,
        salePrice: true,
        costPrice: true,
        currentStock: true,
        minStock: true,
        unit: true,
        isActive: true,
        trackStock: true,
      },
    });

    const productById = new Map(products.map((p) => [p.id, p]));

    const items = sale.items
      .filter((item) => item.productId && productById.has(item.productId))
      .map((item) => {
        const product = productById.get(item.productId as string);
        if (!product) throw new Error("unreachable");
        return {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          image: product.thumbnail,
          salePrice: Number(product.salePrice),
          costPrice: Number(product.costPrice),
          currentStock: Number(product.currentStock),
          minStock: Number(product.minStock),
          unit: product.unit,
          isActive: product.isActive,
          trackStock: product.trackStock,
          quantity: Number(item.quantity),
          unitPriceAtRequest: Number(item.unitPrice),
        };
      });

    // Fecha a Sale pendente pra não voltar na fila. Mantém histórico via
    // CANCELLED + nota — o operador cria a Sale nova no PDV.
    await prisma.sale.update({
      where: { id: sale.id },
      data: {
        status: SaleStatus.CANCELLED,
        cancelledAt: new Date(),
        notes:
          (sale.notes ? `${sale.notes}\n` : "") +
          `Aprovada no PDV por ${context.user.name ?? context.user.email} — venda gerada no balcão.`,
      },
    });

    return {
      customer: sale.customer,
      items,
    };
  });
