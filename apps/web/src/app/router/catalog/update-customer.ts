import { base } from "@/app/middlewares/base";
import { PersonType } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import z from "zod";

export const updateCustomer = base
  .route({
    method: "POST",
    summary: "Obter usuário do catálogo",
    tags: ["get-user-catalog"],
  })
  .input(
    z.object({
      subdomain: z.string(),
      email: z.string(),
      name: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      document: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      notes: z.string().optional(),
      zipCode: z.string().optional(),
      addressNumber: z.string().optional(),
      complement: z.string().optional(),
      neighborhood: z.string().optional(),
      personType: z.enum(PersonType).optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const organization = await prisma.organization.findUnique({
      where: {
        subdomain: input.subdomain,
      },
    });

    if (!organization) {
      throw errors.NOT_FOUND();
    }

    const userCatalog = await prisma.customer.findFirst({
      where: {
        email: input.email,
        organizationId: organization.id,
      },
    });

    if (!userCatalog) {
      throw errors.BAD_REQUEST();
    }

    const { subdomain, email, ...rest } = input;

    await prisma.customer.update({
      data: {
        ...rest,
      },
      where: {
        id: userCatalog.id,
      },
    });
  });
