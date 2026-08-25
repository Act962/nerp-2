import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import z from "zod";

export const listKitchenColumns = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar colunas da cozinha",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      includeInactive: z.boolean().optional(),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        color: z.string(),
        position: z.number(),
        wipLimit: z.number().nullable(),
        isActive: z.boolean(),
        description: z.string().nullable(),
        icon: z.string().nullable(),
        isInitial: z.boolean(),
        showOnTv: z.boolean(),
        isFinal: z.boolean(),
      }),
    ),
  )
  .handler(async ({ context, input }) => {
    const where: Prisma.KitchenColumnWhereInput = {
      organizationId: context.org.id,
      ...(input.includeInactive ? {} : { isActive: true }),
    };

    const columns = await prisma.kitchenColumn.findMany({
      where,
      orderBy: { position: "asc" },
    });

    return columns.map((column) => ({
      id: column.id,
      name: column.name,
      color: column.color,
      position: column.position,
      wipLimit: column.wipLimit,
      isActive: column.isActive,
      description: column.description,
      icon: column.icon,
      isInitial: column.isInitial,
      showOnTv: column.showOnTv,
      isFinal: column.isFinal,
    }));
  });
