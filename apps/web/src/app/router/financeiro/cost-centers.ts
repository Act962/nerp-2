import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Centros de custo (agrupam lançamentos por área/projeto).
const p = base.use(requireAuthMiddleware).use(requireOrgMiddleware);

const costCenterOutput = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
});

export const listCostCenters = p
  .input(z.object({ includeInactive: z.boolean().optional() }).optional())
  .output(z.object({ costCenters: z.array(costCenterOutput) }))
  .handler(async ({ input, context }) => {
    const costCenters = await prisma.paymentCostCenter.findMany({
      where: {
        organizationId: context.org.id,
        ...(input?.includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: "asc" },
    });
    return { costCenters };
  });

export const createCostCenter = p
  .input(
    z.object({
      name: z.string().min(1, "Informe o nome do centro de custo"),
      description: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const created = await prisma.paymentCostCenter.create({
      data: {
        organizationId: context.org.id,
        name: input.name,
        description: input.description || null,
      },
      select: { id: true },
    });
    return created;
  });

export const updateCostCenter = p
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const costCenter = await prisma.paymentCostCenter.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!costCenter)
      throw errors.NOT_FOUND({ message: "Centro de custo não encontrado" });
    await prisma.paymentCostCenter.update({
      where: { id: input.id },
      data: {
        name: input.name,
        description: input.description,
        isActive: input.isActive,
      },
    });
    return { ok: true };
  });

export const deleteCostCenter = p
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean(), deactivated: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const costCenter = await prisma.paymentCostCenter.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, _count: { select: { entries: true } } },
    });
    if (!costCenter)
      throw errors.NOT_FOUND({ message: "Centro de custo não encontrado" });

    if (costCenter._count.entries > 0) {
      await prisma.paymentCostCenter.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      return { ok: true, deactivated: true };
    }
    await prisma.paymentCostCenter.delete({ where: { id: input.id } });
    return { ok: true, deactivated: false };
  });
