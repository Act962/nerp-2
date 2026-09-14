import { base } from "@/app/middlewares/base";
import { CatalogOperationMode, SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { resolveGuestCustomer } from "@/lib/pedidos/resolve-guest-customer";
import {
  nextSaleNumber,
  resolveSaleItems,
} from "@/lib/pedidos/resolve-sale-items";
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
              notes: z.string().max(200).optional(),
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
      customerId = await resolveGuestCustomer({
        organizationId: organization.id,
        guest: input.guest,
        origem: "Cliente criado via Catálogo Online (modo Aprovação).",
      });
    } else {
      // Refine impede — proteção redundante.
      throw errors.BAD_REQUEST({ message: "Cliente não informado." });
    }

    // Produtos validados contra a org e preço resolvido no servidor pela tabela
    // do Customer; produto sem controle de estoque não é barrado por saldo.
    const resolved = await resolveSaleItems({
      organizationId: organization.id,
      customerId,
      products: input.products,
    });

    if (!resolved.ok) {
      throw errors.NOT_FOUND({
        message: "Alguns produtos não foram encontrados ou estão sem estoque!",
      });
    }

    // Numeração atômica (evita corrida com o count() usado no PDV).
    const saleNumber = await nextSaleNumber(organization.id);

    const sale = await prisma.sale.create({
      data: {
        organizationId: organization.id,
        customerId,
        priceListId: resolved.priceListId,
        subtotal: resolved.subtotal,
        total: resolved.subtotal,
        saleNumber,
        status: SaleStatus.PENDING_APPROVAL,
        notes:
          input.notes ?? "Pedido do Catálogo Online (aguardando aprovação)",
        items: {
          createMany: { data: resolved.items },
        },
      },
    });

    return { saleId: sale.id, saleNumber: sale.saleNumber };
  });
