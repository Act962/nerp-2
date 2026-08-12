import { base } from "@/app/middlewares/base";
import { CatalogOperationMode, SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { resolveManyPrices } from "@/features/precos/server/resolve-price";
import { z } from "zod";

/**
 * Checkout do modo APPROVAL (aprovação presencial).
 *
 * O cliente do Catálogo Online monta o carrinho e envia — nada é cobrado
 * online. Cria uma `Sale` com status `PENDING_APPROVAL` que fica na fila
 * do PDV; o operador aprova em `/vendas/novo`, o carrinho é hidratado a
 * partir dos itens da Sale pendente, e a Sale pendente é fechada
 * (CANCELLED com nota "convertida em venda de balcão") pra o operador
 * criar a Sale real do balcão sem duplicidade de estoque/pagamento.
 *
 * Multi-tenant: `organizationId` sempre resolvido a partir do `subdomain`
 * público; nenhum id de cliente/produto é usado sem re-validar contra
 * essa org.
 */
export const approvalCheckout = base
  .input(
    z
      .object({
        products: z
          .array(
            z.object({
              id: z.string(),
              quantity: z.number().int().positive(),
            }),
          )
          .min(1),
        domain: z.string().min(1),
        // Pra clientes logados no catálogo (fluxo antigo, compatível).
        customerId: z.string().min(1).optional(),
        // Alternativa sem login: cliente digita nome (obrigatório) e telefone
        // (opcional) pra o operador identificar quando chegar ao balcão.
        // Um dos dois precisa vir.
        guest: z
          .object({
            name: z.string().min(1).max(120),
            phone: z.string().max(30).optional(),
          })
          .optional(),
        notes: z.string().optional(),
      })
      .refine((v) => Boolean(v.customerId) || Boolean(v.guest), {
        message: "Informe customerId ou guest.name",
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
      select: { operationMode: true, allowOrders: true },
    });

    if (
      settings?.operationMode !== CatalogOperationMode.APPROVAL ||
      !settings.allowOrders
    ) {
      throw errors.BAD_REQUEST({
        message:
          "A organização não aceita pedidos com aprovação presencial no momento.",
      });
    }

    // Resolve o Customer:
    //   - Se customerId vindo do CatalogUser (cliente logado no catálogo),
    //     usa o Customer real vinculado.
    //   - Se guest: reusa Customer walk-in pelo telefone (quando existir);
    //     senão cria um novo. Assim clientes recorrentes não enchem a base
    //     e o operador enxerga histórico do mesmo telefone.
    let customerId: string;
    if (input.customerId) {
      const catalogUser = await prisma.catalogUser.findUnique({
        where: { id: input.customerId },
        include: { customer: true },
      });
      if (!catalogUser?.customer) {
        throw errors.NOT_FOUND({ message: "Cliente não encontrado!" });
      }
      customerId = catalogUser.customer.id;
    } else if (input.guest) {
      const phone = input.guest.phone?.trim() || null;
      let existing = null as { id: string } | null;
      if (phone) {
        existing = await prisma.customer.findFirst({
          where: { organizationId: organization.id, phone },
          select: { id: true },
        });
      }
      if (existing) {
        customerId = existing.id;
        // Atualiza o nome se veio diferente — cliente pode ter digitado o
        // nome completo esta vez.
        await prisma.customer.update({
          where: { id: existing.id },
          data: { name: input.guest.name },
        });
      } else {
        const created = await prisma.customer.create({
          data: {
            organizationId: organization.id,
            name: input.guest.name,
            phone,
            notes: "Cliente criado via Catálogo Online (modo Aprovação).",
          },
          select: { id: true },
        });
        customerId = created.id;
      }
    } else {
      // Refine impede — proteção redundante.
      throw errors.BAD_REQUEST({ message: "Cliente não informado." });
    }

    const productIds = input.products.map((p) => p.id);
    // Produtos sem controle de estoque (trackStock=false) não bloqueiam
    // por currentStock — o operador confirma disponibilidade no balcão.
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        organizationId: organization.id,
        isActive: true,
        OR: [{ trackStock: false }, { currentStock: { gte: 1 } }],
      },
    });

    if (products.length !== input.products.length) {
      throw errors.NOT_FOUND({
        message: "Alguns produtos não foram encontrados ou estão sem estoque!",
      });
    }

    // Preço resolvido pelo server via `priceListId` do Customer (o pedido de
    // catálogo já rebaixou o CatalogUser → Customer acima). Guest sem tabela
    // cai na default da org.
    const customerForPricing = await prisma.customer.findFirst({
      where: { id: customerId, organizationId: organization.id },
      select: { priceListId: true },
    });
    const resolved = await resolveManyPrices({
      organizationId: organization.id,
      priceListId: customerForPricing?.priceListId ?? null,
      items: input.products.map((p) => ({ productId: p.id, quantity: p.quantity })),
    });

    const items = input.products.map((inputProduct, i) => {
      const product = products.find((p) => p.id === inputProduct.id)!;
      const unitPrice = resolved[i].unitPrice;
      return {
        productId: product.id,
        productName: product.name,
        quantity: inputProduct.quantity,
        unitPrice,
        total: unitPrice * inputProduct.quantity,
      };
    });

    const subtotal = items.reduce((acc, item) => acc + item.total, 0);
    const usedPriceListId = resolved[0]?.priceListId ?? null;

    // Numeração atômica (evita corrida com o count() usado no PDV).
    const org = await prisma.organization.update({
      where: { id: organization.id },
      data: { lastSaleNumber: { increment: 1 } },
      select: { lastSaleNumber: true },
    });

    const sale = await prisma.sale.create({
      data: {
        organizationId: organization.id,
        customerId,
        priceListId: usedPriceListId,
        subtotal,
        total: subtotal,
        saleNumber: org.lastSaleNumber,
        status: SaleStatus.PENDING_APPROVAL,
        notes: input.notes ?? "Pedido do Catálogo Online (aguardando aprovação)",
        items: {
          createMany: { data: items },
        },
      },
    });

    return { saleId: sale.id, saleNumber: sale.saleNumber };
  });
