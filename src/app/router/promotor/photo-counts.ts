import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { capturedAtFilter, dateRangeSchema } from "./_date-range";

// Contagem por status do promotor logado. Separada das listas de propósito: os
// chips precisam dos QUATRO números ao mesmo tempo, e o cabeçalho precisa do
// total de reprovadas antes de qualquer lista abrir. Uma linha por status —
// custa um `groupBy` e não depende de nada estar carregado na tela.
export const getMyPhotoCounts = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      storeId: z.string().optional(),
      supplierId: z.string().nullable().optional(),
      ...dateRangeSchema,
    }),
  )
  .output(
    z.object({
      all: z.number(),
      approved: z.number(),
      rejected: z.number(),
      pending: z.number(),
    }),
  )
  .handler(async ({ input, context }) => {
    const rows = await prisma.pdvPhoto.groupBy({
      by: ["approvalStatus"],
      where: {
        organizationId: context.org.id,
        createdById: context.user.id,
        ...(input.storeId ? { storeId: input.storeId } : {}),
        ...(input.supplierId !== undefined
          ? { supplierId: input.supplierId }
          : {}),
        ...capturedAtFilter(input.from, input.to),
      },
      _count: true,
    });

    const countBy = (status: string) =>
      rows.find((row) => row.approvalStatus === status)?._count ?? 0;

    return {
      all: rows.reduce((sum, row) => sum + row._count, 0),
      approved: countBy("APPROVED"),
      rejected: countBy("REJECTED"),
      pending: countBy("PENDING"),
    };
  });
