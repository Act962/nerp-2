import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const createCustomer = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string(),
      document: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      type: z.enum(["FISICA", "JURIDICA"]),
      city: z.string().optional(),
      state: z.string().optional(),
      cep: z.string().optional(),
      address: z.string().optional(),
      description: z.string().optional(),
      priceListId: z.string().nullable().optional(),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // Email é opcional; quando presente, normalizamos e garantimos unicidade
    // por organização. Vazio/espaços viram `undefined` (gravado como null) para
    // não colidir na constraint única `organizationId_email`.
    const email = input.email?.trim() || undefined;

    if (email) {
      const customerWithSameEmail = await prisma.customer.findUnique({
        where: {
          organizationId_email: {
            email,
            organizationId: context.org.id,
          },
        },
      });

      if (customerWithSameEmail) {
        throw errors.BAD_REQUEST({
          message: "Cliente já cadastrado",
        });
      }
    }

    const customer = await prisma.customer.create({
      data: {
        name: input.name,
        document: input.document,
        phone: input.phone,
        email,
        personType: input.type,
        zipCode: input.cep,
        notes: input.description,
        city: input.city,
        state: input.state,
        address: input.address,
        organizationId: context.org.id,
        priceListId: input.priceListId,
      },
    });

    return {
      id: customer.id,
      name: customer.name,
    };
  });
