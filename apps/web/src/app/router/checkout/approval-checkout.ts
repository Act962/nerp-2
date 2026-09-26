import { base } from "@/app/middlewares/base";
import { CatalogOperationMode } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { createPendingSale } from "@/features/storefront/server/create-pending-sale";
import { toCheckoutError } from "./pending-sale-errors";
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

    try {
      return await createPendingSale({
        organizationId: organization.id,
        products: input.products,
        customerId: input.customerId,
        guest: input.guest,
        notes: input.notes,
        defaultSaleNote: "Pedido do Catálogo Online (aguardando aprovação)",
        newCustomerNote: "Cliente criado via Catálogo Online (modo Aprovação).",
      });
    } catch (error) {
      throw toCheckoutError(error, errors);
    }
  });
