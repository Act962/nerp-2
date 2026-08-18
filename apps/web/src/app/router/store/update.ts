import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { canManageStores } from "@/app/router/field-map/_can-manage-stores";
import prisma from "@/lib/db";
import { z } from "zod";

export const updateStore = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(2).optional(),
      code: z.string().optional(),
      managerName: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      notes: z.string().optional(),
      coverImageKey: z.string().nullable().optional(),
      isActive: z.boolean().optional(),
      areaM2: z.number().positive().nullable().optional(),
      monthlyCost: z.number().nonnegative().nullable().optional(),
      customersPerDay: z.number().int().nonnegative().nullable().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!(await canManageStores(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para editar lojas",
      });
    }

    const { id, ...data } = input;

    const store = await prisma.store.findFirst({
      where: { id, organizationId: context.org.id },
      select: { id: true },
    });

    if (!store) {
      throw errors.NOT_FOUND({ message: "Loja não encontrada" });
    }

    return prisma.store.update({ where: { id }, data });
  });
