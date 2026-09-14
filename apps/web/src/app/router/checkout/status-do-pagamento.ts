import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import z from "zod";

/**
 * "Já caiu?" — a tela do PIX pergunta isto de dois em dois segundos.
 *
 * Pública, com o mesmo modelo de confiança do QR do pedido: o id da cobrança é
 * um cuid não-adivinhável, e quem o tem é quem acabou de fazer o pedido.
 * Devolve só o que a tela precisa — nada de valor de outra cobrança, nada de
 * dado do provedor, nada que sirva para enumerar pedidos da loja.
 */
export const statusDoPagamento = base
  .route({
    method: "GET",
    summary: "Status da cobrança do pedido",
    tags: ["checkout"],
  })
  .input(z.object({ chargeId: z.string().min(1) }))
  .output(
    z.object({
      pago: z.boolean(),
      /** Só para a tela decidir entre "esperando" e "não rolou". */
      encerrada: z.boolean(),
      ticketId: z.string().nullable(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const cobranca = await prisma.charge.findUnique({
      where: { id: input.chargeId },
      select: {
        status: true,
        sale: {
          select: {
            kitchenOrders: {
              where: { ticketId: { not: null } },
              select: { ticketId: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!cobranca) {
      throw errors.NOT_FOUND({ message: "Cobrança não encontrada" });
    }

    const pago = cobranca.status === "PAID";

    return {
      pago,
      encerrada:
        cobranca.status === "EXPIRED" ||
        cobranca.status === "FAILED" ||
        cobranca.status === "REFUNDED",
      ticketId: pago
        ? (cobranca.sale?.kitchenOrders[0]?.ticketId ?? null)
        : null,
    };
  });
