import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  ORBITA_OWNS_ORDER_MESSAGE,
  appendNote,
  rejectedNote,
} from "@/features/pedidos/utils/catalog-order-status";
import { SaleOrigin, SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { z } from "zod";

/**
 * Recusa um pedido do Catálogo no modo APPROVAL que ainda aguarda a loja.
 *
 * Pedido pendente não baixou estoque nem gerou pagamento, então recusar é só
 * fechar a venda como CANCELLED com o motivo na nota. A transição sai de
 * PENDING_APPROVAL por `updateMany` condicional: se o PDV aprovou no mesmo
 * instante, a recusa não passa por cima.
 */
export const rejectCatalogOrder = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Recusar pedido do Catálogo Online aguardando aprovação",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      saleId: z.string().min(1),
      reason: z
        .string()
        .trim()
        .min(3, "Informe o motivo da recusa")
        .max(500, "Motivo muito longo"),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    const sale = await prisma.sale.findFirst({
      where: { id: input.saleId, organizationId: context.org.id },
      select: { id: true, origin: true, status: true, notes: true },
    });
    if (!sale) {
      throw errors.NOT_FOUND({ message: "Pedido não encontrado." });
    }
    if (sale.origin === SaleOrigin.CATALOGO_ORBITA) {
      throw errors.BAD_REQUEST({ message: ORBITA_OWNS_ORDER_MESSAGE });
    }
    if (
      sale.origin !== SaleOrigin.CATALOGO_APROVACAO ||
      sale.status !== SaleStatus.PENDING_APPROVAL
    ) {
      throw errors.BAD_REQUEST({
        message:
          "Só pedidos aguardando confirmação da loja podem ser recusados.",
      });
    }

    const updated = await prisma.sale.updateMany({
      where: {
        id: sale.id,
        organizationId: context.org.id,
        status: SaleStatus.PENDING_APPROVAL,
      },
      data: {
        status: SaleStatus.CANCELLED,
        cancelledAt: new Date(),
        notes: appendNote(
          sale.notes,
          rejectedNote(context.user.name ?? context.user.email, input.reason),
        ),
      },
    });
    if (updated.count === 0) {
      throw errors.BAD_REQUEST({
        message: "Pedido já foi processado por outra pessoa.",
      });
    }

    return { ok: true as const };
  });
