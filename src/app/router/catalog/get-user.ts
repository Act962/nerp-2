import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import z from "zod";

export const getUserCatalog = base
  .route({
    method: "POST",
    summary: "Obter usuário do catálogo",
    tags: ["get-user-catalog"],
  })
  .input(
    z.object({
      email: z.string(),
      subdomain: z.string(),
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

    return {
      userCatalog,
    };
  });
