import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

export const createRegionCostBenchmark = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      state: z.string().trim().min(2).max(2),
      city: z.string().trim().optional(),
      costPerM2: z.number().positive(),
      source: z.string().trim().optional(),
      year: z.number().int().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const benchmark = await prisma.regionCostBenchmark.create({
        data: {
          organizationId: context.org.id,
          state: input.state.toUpperCase(),
          city: input.city ?? "",
          costPerM2: input.costPerM2,
          source: input.source,
          year: input.year,
        },
        select: { id: true },
      });
      return { id: benchmark.id };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw errors.BAD_REQUEST({
          message: "Já existe um benchmark para essa cidade/estado",
        });
      }
      throw error;
    }
  });
