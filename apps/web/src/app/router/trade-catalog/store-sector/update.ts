import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

export const updateStoreSector = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      code: z.string().trim().min(1).max(6).optional(),
      name: z.string().trim().min(1).optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id, code, ...rest } = input;

    const existing = await prisma.storeSector.findFirst({
      where: { id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Setor não encontrado" });
    }

    try {
      return await prisma.storeSector.update({
        where: { id },
        data: { ...rest, code: code ? code.toUpperCase() : undefined },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw errors.BAD_REQUEST({
          message: "Já existe um setor com esse código",
        });
      }
      throw error;
    }
  });
