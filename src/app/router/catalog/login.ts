import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import z from "zod";
import { compare } from "bcrypt";

export const loginCatalog = base
  .route({
    method: "GET",
    summary: "fazer login no catálogo",
    tags: ["settings-catalog"],
  })
  .input(
    z.object({
      email: z.string(),
      password: z.string().min(8),
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

    const user = await prisma.catalogUser.findUnique({
      where: {
        organizationId_email: {
          organizationId: organization.id,
          email: input.email,
        },
      },
    });

    if (!user) {
      throw errors.NOT_FOUND();
    }

    const passwordMatched = await compare(input.password, user.passwordHash);

    if (!passwordMatched) {
      throw errors.UNAUTHORIZED();
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return {
      userWithoutPassword,
    };
  });
