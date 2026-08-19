import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Categorias financeiras (receita/despesa/custo), com hierarquia opcional.
const p = base.use(requireAuthMiddleware).use(requireOrgMiddleware);

const categoryType = z.enum(["REVENUE", "EXPENSE", "COST"]);

const categoryOutput = z.object({
  id: z.string(),
  name: z.string(),
  type: categoryType,
  color: z.string().nullable(),
  icon: z.string().nullable(),
  parentId: z.string().nullable(),
  isActive: z.boolean(),
  isOperational: z.boolean(),
});

export const listCategories = p
  .input(
    z
      .object({
        type: categoryType.optional(),
        includeInactive: z.boolean().optional(),
      })
      .optional(),
  )
  .output(z.object({ categories: z.array(categoryOutput) }))
  .handler(async ({ input, context }) => {
    const categories = await prisma.paymentCategory.findMany({
      where: {
        organizationId: context.org.id,
        ...(input?.type ? { type: input.type } : {}),
        ...(input?.includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
    return { categories };
  });

export const createCategory = p
  .input(
    z.object({
      name: z.string().min(1, "Informe o nome da categoria"),
      type: categoryType,
      color: z.string().optional(),
      icon: z.string().optional(),
      parentId: z.string().optional(),
      isOperational: z.boolean().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (input.parentId) {
      const parent = await prisma.paymentCategory.findFirst({
        where: { id: input.parentId, organizationId: context.org.id },
        select: { id: true },
      });
      if (!parent)
        throw errors.NOT_FOUND({ message: "Categoria pai não encontrada" });
    }
    const created = await prisma.paymentCategory.create({
      data: {
        organizationId: context.org.id,
        name: input.name,
        type: input.type,
        color: input.color || null,
        icon: input.icon || null,
        parentId: input.parentId || null,
        isOperational: input.isOperational ?? true,
      },
      select: { id: true },
    });
    return created;
  });

export const updateCategory = p
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      color: z.string().nullable().optional(),
      icon: z.string().nullable().optional(),
      isActive: z.boolean().optional(),
      isOperational: z.boolean().optional(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const category = await prisma.paymentCategory.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!category)
      throw errors.NOT_FOUND({ message: "Categoria não encontrada" });
    await prisma.paymentCategory.update({
      where: { id: input.id },
      data: {
        name: input.name,
        color: input.color,
        icon: input.icon,
        isActive: input.isActive,
        isOperational: input.isOperational,
      },
    });
    return { ok: true };
  });

export const deleteCategory = p
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean(), deactivated: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const category = await prisma.paymentCategory.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: {
        id: true,
        _count: { select: { entries: true, children: true } },
      },
    });
    if (!category)
      throw errors.NOT_FOUND({ message: "Categoria não encontrada" });

    if (category._count.entries > 0 || category._count.children > 0) {
      await prisma.paymentCategory.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      return { ok: true, deactivated: true };
    }
    await prisma.paymentCategory.delete({ where: { id: input.id } });
    return { ok: true, deactivated: false };
  });
