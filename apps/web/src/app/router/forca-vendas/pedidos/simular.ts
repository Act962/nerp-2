import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVendedorMiddleware } from "@/app/middlewares/vendedor";
import { simularPedido } from "@/features/forca-vendas/server/pedidos";
import { z } from "zod";

// A mesma conta do envio, sem gravar: preço, flex e o que vai para aprovação.
export const simularPedidoFv = base
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
    }),
  )
  .handler(async ({ input, context }) =>
    simularPedido({
      organizationId: context.org.id,
      vendedor: context.vendedor,
      entrada: input,
    }),
  );
