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
  .handler(async ({ input, errors }) => {
    const customer = await prisma.customer.findUnique({
      where: {
        id: input.id,
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
