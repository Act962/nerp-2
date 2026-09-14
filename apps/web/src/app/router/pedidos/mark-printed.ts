import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

/**
 * Marca o ticket como impresso.
 *
 * O filtro `printedAt: null` é a trava contra cupom duplicado: se duas estações
 * estiverem conectadas, a segunda recebe `count: 0` e sabe que o papel já saiu
 * na outra. `force` existe para o botão "imprimir de novo", que é uma decisão
 * de quem está olhando a impressora.
 */
export const markTicketPrinted = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Marcar ticket como impresso",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      ticketId: z.string().min(1),
      force: z.boolean().optional(),
    }),
  )
  .output(z.object({ count: z.number() }))
  .handler(async ({ context, input }) => {
    const result = await prisma.kitchenOrder.updateMany({
      where: {
        organizationId: context.org.id,
        ticketId: input.ticketId,
        ...(input.force ? {} : { printedAt: null }),
      },
      data: { printedAt: new Date() },
    });

    return { count: result.count };
  });
