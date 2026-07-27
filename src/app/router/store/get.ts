import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const getStore = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const store = await prisma.store.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: {
        id: true,
        name: true,
        code: true,
        managerName: true,
        address: true,
        city: true,
        state: true,
        notes: true,
        coverImageKey: true,
        isActive: true,
        areaM2: true,
        monthlyCost: true,
        customersPerDay: true,
      },
    });

    if (!store) {
      throw errors.NOT_FOUND({ message: "Loja não encontrada" });
    }

    return {
      store: {
        ...store,
        monthlyCost: store.monthlyCost ? Number(store.monthlyCost) : null,
      },
    };
  });
