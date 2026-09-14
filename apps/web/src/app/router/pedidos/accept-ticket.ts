import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { aceitarTicket } from "@/lib/pedidos/aceitar-ticket";
import z from "zod";

/**
 * O dono aceita o pedido pelo board.
 *
 * A regra mora em `lib/pedidos/aceitar-ticket.ts` porque três caminhos chegam
 * nela: este, o app do garçom e o webhook de pagamento.
 */
export const acceptTicket = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Aceitar pedido do cardápio",
    tags: ["kitchen"],
  })
  .input(z.object({ ticketId: z.string().min(1) }))
  .output(z.object({ accepted: z.number() }))
  .handler(async ({ context, input, errors }) => {
    const resultado = await aceitarTicket({
      organizationId: context.org.id,
      ticketId: input.ticketId,
      quem: {
        tipo: "USUARIO",
        userId: context.user.id,
        nome: context.user.name ?? context.user.email ?? "Usuário",
        foto: context.user.image ?? null,
      },
    });

    if (!resultado.ok) {
      throw resultado.motivo === "sem-coluna-inicial"
        ? errors.BAD_REQUEST({
            message: "Nenhuma coluna de entrada configurada para a cozinha!",
          })
        : errors.NOT_FOUND({ message: "Pedido não encontrado ou já aceito." });
    }

    return { accepted: resultado.aceitos };
  });
