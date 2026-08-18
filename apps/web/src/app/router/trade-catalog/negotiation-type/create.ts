import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

export const createNegotiationType = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      code: z.string().trim().min(1).max(6),
      name: z.string().trim().min(1),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const negotiationType = await prisma.negotiationType.create({
        data: {
          organizationId: context.org.id,
          code: input.code.toUpperCase(),
          name: input.name,
        },
        select: { id: true },
      });
      return { id: negotiationType.id };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw errors.BAD_REQUEST({
          message: "Já existe um tipo de negociação com esse código",
        });
      }
      throw error;
    }
  });
