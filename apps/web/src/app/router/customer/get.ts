import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Customer, Sale } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import z from "zod";

type CustomerWithSales = Customer & {
  sales: Sale[];
};

export const getCustomer = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
    }),
  )
  // .output(
  //   z.object({
  //     customer: z.custom<CustomerWithSales>(),
  //   })
  // )
  .handler(async ({ input, context, errors }) => {
    // O `id` chega do cliente e precisa ser confrontado com a organização
    // antes de qualquer uso: sem o filtro, esta consulta devolvia o cadastro
    // **e o histórico de compras** de um cliente de outro tenant para quem
    // soubesse um id.
    const customer = await prisma.customer.findFirst({
      where: {
        id: input.id,
        organizationId: context.org.id,
      },
      include: {
        sales: true,
      },
    });

    if (!customer) {
      throw errors.NOT_FOUND({
        message: "Cliente não encontrado",
      });
    }

    return {
      customer: customer,
    };
  });
