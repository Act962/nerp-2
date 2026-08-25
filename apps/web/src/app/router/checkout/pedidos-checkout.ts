import { base } from "@/app/middlewares/base";
import { CatalogOperationMode, SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { createKitchenOrdersFromSale } from "@/lib/pedidos/create-orders-from-sale";
import { z } from "zod";

/**
 * Checkout do modo Cozinha (KITCHEN).
 *
 * Diferente do fluxo MARKETPLACE (que redireciona para o Asaas), aqui o pedido
 * não passa por cobrança online: a `Sale` é criada já como CONFIRMED e enviada
 * direto para a cozinha (KDS) via `createKitchenOrdersFromSale`. O cliente é
 * então levado a uma página de "parabéns pela compra".
 */
export const kitchenCheckout = base
  .input(
    z.object({
      products: z
        .array(
          z.object({
            id: z.string(),
            quantity: z.number().int().positive(),
          }),
        )
        .min(1),
      domain: z.string().min(1),
      customerId: z.string().min(1),
      notes: z.string().optional(),
    }),
  )
  .output(
    z.object({
      saleId: z.string(),
      saleNumber: z.number(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const organization = await prisma.organization.findUnique({
      where: { subdomain: input.domain },
    });

    if (!organization) {
      throw errors.NOT_FOUND({ message: "Organização não encontrada!" });
    }

    const settings = await prisma.catalogSettings.findUnique({
      where: { organizationId: organization.id },
      select: { operationMode: true },
    });

    if (settings?.operationMode !== CatalogOperationMode.KITCHEN) {
      throw errors.BAD_REQUEST({
        message: "A organização não está no modo Cozinha.",
      });
    }

    const customer = await prisma.catalogUser.findUnique({
      where: { id: input.customerId },
      include: { customer: true },
    });

    if (!customer?.customer) {
      throw errors.NOT_FOUND({ message: "Cliente não encontrado!" });
    }

    const productIds = input.products.map((p) => p.id);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        currentStock: { gte: 1 },
        organizationId: organization.id,
      },
    });

    if (products.length !== input.products.length) {
      throw errors.NOT_FOUND({
        message: "Alguns produtos não foram encontrados ou estão sem estoque!",
      });
    }

    const items = input.products.map((inputProduct) => {
      const product = products.find((p) => p.id === inputProduct.id)!;
      const unitPrice = Number(product.salePrice);

      return {
        productId: product.id,
        productName: product.name,
        quantity: inputProduct.quantity,
        unitPrice,
        total: unitPrice * inputProduct.quantity,
      };
    });

    const subtotal = items.reduce((acc, item) => acc + item.total, 0);

    const lastSale = await prisma.sale.findFirst({
      where: { organizationId: organization.id },
      orderBy: { saleNumber: "desc" },
    });

    const saleNumber = lastSale?.saleNumber ? lastSale.saleNumber + 1 : 1;

    const sale = await prisma.sale.create({
      data: {
        organizationId: organization.id,
        customerId: customer.customer.id,
        subtotal,
        total: subtotal,
        saleNumber,
        status: SaleStatus.CONFIRMED,
        notes: input.notes,
        items: {
          createMany: {
            data: items,
          },
        },
      },
    });

    // Envia o pedido à cozinha. Falha aqui não deve derrubar o checkout
    // (a venda já foi criada).
    try {
      await createKitchenOrdersFromSale(sale.id);
    } catch (kitchenError) {
      console.error("Erro ao enviar pedido à cozinha:", kitchenError);
    }

    return { saleId: sale.id, saleNumber };
  });
