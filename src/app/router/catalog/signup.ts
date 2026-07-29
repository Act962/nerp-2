import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import z from "zod";
import { hash } from "bcrypt";

export const signupCatalog = base
  .route({
    method: "POST",
    summary: "Criar login do usuário do catálogo",
    tags: ["settings-catalog"],
  })
  .input(
    z.object({
      name: z.string(),
      email: z.string(),
      document: z.string(),
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
          email: input.email,
          organizationId: organization.id,
        },
      },
    });

    if (user) {
      throw errors.BAD_REQUEST({
        message: "Usuário com este email ja está cadastrado",
      });
    }

    const hashedPassword = await hash(input.password, 8);

    const newUser = await prisma.catalogUser.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: hashedPassword,
        organizationId: organization.id,
        customer: {
          create: {
            name: input.name,
            email: input.email,
            document: input.document,
            organizationId: organization.id,
          },
        },
      },
    });

    const { passwordHash, ...userWithoutPassword } = newUser;

    return {
      userWithoutPassword,
    };
  });
