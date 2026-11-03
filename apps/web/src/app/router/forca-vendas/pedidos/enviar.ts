import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { enviarPedido } from "@/features/forca-vendas/server/pedidos";
import { z } from "zod";

// Grava o pedido. `clientOperationId` torna o reenvio idempotente.
export const enviarPedidoFv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(
    z.object({
      customerId: z.string().min(1, "Escolha o cliente"),
      tipo: z.enum(["VENDA", "ORCAMENTO", "BONIFICACAO", "TROCA"]),
      condicaoPagamentoId: z.string().nullish(),
      visitaId: z.string().nullish(),
      observacao: z.string().max(1000).nullish(),
      itens: z
        .array(
          z.object({
            productId: z.string().min(1),
            quantidade: z
              .number()
              .positive("Quantidade precisa ser maior que zero"),
            precoUnitario: z.number().min(0).nullish(),
          }),
        )
        .min(1, "Adicione ao menos um produto")
        .max(200),
      clientOperationId: z.string().uuid().nullish(),
      latitude: z.number().min(-90).max(90).nullish(),
      longitude: z.number().min(-180).max(180).nullish(),
    }),
  )
  .handler(async ({ input, context }) =>
    enviarPedido({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      entrada: input,
    }),
  );
