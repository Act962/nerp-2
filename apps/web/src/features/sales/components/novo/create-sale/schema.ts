import { PaymentMethod, PersonType } from "@/generated/prisma/enums";
import { z } from "zod";

export const saleSchema = z
  .object({
    cartItems: z
      .array(
        z.object({
          // `id` é o id da LINHA (itens pesáveis geram linhas distintas);
          // `productId` é o produto real, usado no lançamento da venda.
          id: z.string(),
          productId: z.string(),
          name: z.string(),
          price: z.number().positive(),
          quantity: z.number().positive(),
          currentStock: z.number(),
          // Se o produto controla estoque. Sem isto o carrinho não sabe
          // distinguir "acabou" de "nunca controlou" — e tratava os dois como
          // teto rígido da quantidade.
          trackStock: z.boolean().optional(),
          sku: z.string().nullable(),
          // Unidade cadastrada (UN, KG, L, M...). Mostrada no carrinho para o
          // operador saber se digita 0,1 (100g) ou 1 (1 un).
          unit: z.string(),
          // Item cancelado por autorização: fica RISCADO no carrinho (rastro de
          // auditoria) e é excluído dos totais e do lançamento da venda.
          cancelled: z.boolean().optional(),
        }),
      )
      .min(1, "Adicione pelo menos um item ao carrinho"),

    paymentMethod: z.enum(PaymentMethod),
    customer: z
      .object({
        id: z.string(),
        name: z.string(),
        document: z.string().nullable(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
        personType: z.enum(PersonType),
      })
      .optional(),

    discount: z.number().min(0, "Desconto não pode ser negativo"),

    discountType: z.enum(["percent", "value"]),

    // Validação condicional: se for porcentagem, não pode ser > 100
  })
  .refine(
    (data) => {
      if (data.discountType === "percent" && data.discount > 100) {
        return false;
      }
      return true;
    },
    {
      message: "Desconto percentual não pode ser maior que 100%",
      path: ["discount"],
    },
  );

export type SaleFormData = z.infer<typeof saleSchema>;
