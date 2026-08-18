import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  type Customer,
  PersonType,
  type Sale,
} from "@/generated/prisma/client";
import prisma from "@/lib/db";
import z from "zod";

interface CustomerWithSales extends Customer {
  sales: Sale[];
}

export const listCustomer = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .output(
    z.object({
      customers: z.array(z.custom<CustomerWithSales>()),
    }),
  )
  .input(
    z.object({
      personType: z.enum(PersonType).optional(),
      minPurchase: z.number().optional(),
      maxPurchase: z.number().optional(),
      dateIni: z.date().optional(),
      dateEnd: z.date().optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    const customer = await prisma.customer.findMany({
      where: {
        organizationId: context.org.id,
        personType: {
          equals: input.personType,
        },
        ...(input.minPurchase && {
          sales: {
            some: {
              total: {
                gte: input.minPurchase,
              },
            },
          },
        }),
        ...(input.maxPurchase && {
          sales: {
            some: {
              total: {
                lte: input.maxPurchase,
              },
            },
          },
        }),
        ...(input.dateIni &&
          input.dateEnd && {
            createdAt: {
              gte: input.dateIni,
              lte: input.dateEnd,
            },
          }),
      },
      include: {
        sales: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return {
      customers: customer,
    };
  });
