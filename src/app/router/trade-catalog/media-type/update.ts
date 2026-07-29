import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

export const updateMediaType = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      code: z.string().trim().min(1).max(6).optional(),
      name: z.string().trim().min(1).optional(),
      description: z.string().nullable().optional(),
      examples: z.array(z.string()).optional(),
      occupancyRules: z.string().nullable().optional(),
      defaultPhotos: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id, code, ...rest } = input;

    const existing = await prisma.mediaType.findFirst({
      where: { id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Mídia não encontrada" });
    }

    try {
      return await prisma.mediaType.update({
        where: { id },
        data: { ...rest, code: code ? code.toUpperCase() : undefined },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw errors.BAD_REQUEST({
          message: "Já existe uma mídia com esse código",
        });
      }
      throw error;
    }
  });
