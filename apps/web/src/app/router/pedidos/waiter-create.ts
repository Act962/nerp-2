import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { createKitchenOrders } from "@/lib/pedidos/create-kitchen-orders";
import {
  nextSaleNumber,
  resolveSaleItems,
} from "@/lib/pedidos/resolve-sale-items";
import z from "zod";
import { requireMemberOfOrgSlug } from "./_require-member-of-org-slug";

/**
 * Registra o pedido montado no balcão ou na mesa.
 *
 * Exige sessão + vínculo com a organização do slug; o `attendantId` diz apenas
 * quem está atendendo. O pedido entra direto na cozinha — quem monta está com o
 * cliente na frente.
 *
 * Os itens que vêm do catálogo também viram uma `Sale`: sem venda não há preço,
 * e sem preço a conta da mesa seria sempre R$ 0,00. Item de texto livre ("meia
 * porção", "o de sempre do seu Zé") vai para a cozinha mas fica fora da venda,
 * porque não tem preço para cobrar.
 */
export const waiterCreate = base
  .use(requireAuthMiddleware)
  .route({
    method: "POST",
    summary: "Registrar pedidos (kiosk do garçom)",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      orgSlug: z.string().min(1),
      attendantId: z.string().min(1),
      tableNumber: z.string().min(1),
      tableId: z.string().optional(),
      items: z
        .array(
          z.object({
            dishName: z.string().min(1),
            productId: z.string().optional(),
            quantity: z.number().int().positive().default(1),
            estimatedMinutes: z.number().int().positive().optional(),
            notes: z.string().optional(),
          }),
        )
        .min(1),
    }),
  )
  .output(
    z.object({
      count: z.number(),
      ticketId: z.string().nullable(),
      saleNumber: z.number().nullable(),
      total: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const org = await requireMemberOfOrgSlug({
      orgSlug: input.orgSlug,
      userId: context.user.id,
      errors,
    });

    const attendant = await prisma.collaborator.findFirst({
      where: { id: input.attendantId, organizationId: org.id, isActive: true },
      select: { id: true, name: true, photoUrl: true },
    });

    // A mesa vem do id quando o pedido saiu da grade; revalidada contra a org
    // porque id de input nunca é confiável.
    const mesa = input.tableId
      ? await prisma.serviceTable.findFirst({
          where: { id: input.tableId, organizationId: org.id },
          select: { id: true },
        })
      : null;

    if (input.tableId && !mesa) {
      throw errors.NOT_FOUND({ message: "Mesa não encontrada" });
    }

    const doCatalogo = input.items.filter((item) => item.productId);
    let saleId: string | null = null;
    let saleNumber: number | null = null;
    let total = 0;

    if (doCatalogo.length > 0) {
      const resolvido = await resolveSaleItems({
        organizationId: org.id,
        customerId: null,
        products: doCatalogo.map((item) => ({
          // O filtro acima garante; o tipo do TS não sabe disso.
          id: item.productId as string,
          quantity: item.quantity,
          notes: item.notes,
        })),
      });

      if (!resolvido.ok) {
        throw errors.NOT_FOUND({
          message: "Algum item saiu do catálogo. Confira o pedido.",
        });
      }

      const numero = await nextSaleNumber(org.id);
      const venda = await prisma.sale.create({
        data: {
          organizationId: org.id,
          priceListId: resolvido.priceListId,
          subtotal: resolvido.subtotal,
          total: resolvido.subtotal,
          saleNumber: numero,
          // Fica na fila do caixa: quem recebe o dinheiro é o PDV, no
          // fechamento da conta.
          status: SaleStatus.PENDING_APPROVAL,
          notes: `${input.tableNumber} · ${attendant?.name ?? "Balcão"}`,
          items: { createMany: { data: resolvido.items } },
        },
        select: { id: true, saleNumber: true },
      });

      saleId = venda.id;
      saleNumber = venda.saleNumber;
      total = resolvido.subtotal;
    }

    const result = await createKitchenOrders({
      organizationId: org.id,
      tableNumber: input.tableNumber,
      attendantId: input.attendantId,
      items: input.items,
      tableId: mesa?.id ?? null,
      saleId,
      actor: attendant
        ? {
            type: "WAITER",
            collaboratorId: attendant.id,
            name: attendant.name,
            photoUrl: attendant.photoUrl,
          }
        : undefined,
    });

    if (!result.ok) {
      throw errors.BAD_REQUEST({
        message:
          result.reason === "column-not-found"
            ? "Nenhuma coluna de entrada configurada para a cozinha!"
            : "Atendente não encontrado!",
      });
    }

    return {
      count: result.count,
      ticketId: result.ticketId,
      saleNumber,
      total,
    };
  });
