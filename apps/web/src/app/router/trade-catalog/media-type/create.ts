import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { MediaKind, Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

export const createMediaType = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      kind: z.enum(MediaKind),
      code: z.string().trim().min(1).max(6),
      name: z.string().trim().min(1),
      description: z.string().nullable().optional(),
      examples: z.array(z.string()).optional(),
      occupancyRules: z.string().nullable().optional(),
      defaultPhotos: z.array(z.string()).optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const mediaType = await prisma.mediaType.create({
        data: {
          organizationId: context.org.id,
          kind: input.kind,
          code: input.code.toUpperCase(),
          name: input.name,
          description: input.description ?? null,
          examples: input.examples ?? [],
          occupancyRules: input.occupancyRules ?? null,
          defaultPhotos: input.defaultPhotos ?? [],
        },
        select: { id: true },
      });
      return { id: mediaType.id };
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
