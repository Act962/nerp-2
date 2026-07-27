import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const createStore = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
      code: z.string().optional(),
      managerName: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      notes: z.string().optional(),
      coverImageKey: z.string().nullable().optional(),
      areaM2: z.number().positive().nullable().optional(),
      monthlyCost: z.number().nonnegative().nullable().optional(),
      customersPerDay: z.number().int().nonnegative().nullable().optional(),
    }),
  )
  .output(z.object({ id: z.string(), name: z.string() }))
  .handler(async ({ input, context }) => {
    const store = await prisma.store.create({
      data: {
        organizationId: context.org.id,
        name: input.name,
        code: input.code,
        managerName: input.managerName,
        address: input.address,
        city: input.city,
        state: input.state,
        notes: input.notes,
        coverImageKey: input.coverImageKey,
        areaM2: input.areaM2,
        monthlyCost: input.monthlyCost,
        customersPerDay: input.customersPerDay,
      },
    });

    return { id: store.id, name: store.name };
  });
