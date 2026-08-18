import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const listStoreSector = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ includeInactive: z.boolean().optional() }))
  .handler(async ({ input, context }) => {
    const items = await prisma.storeSector.findMany({
      where: {
        organizationId: context.org.id,
        isActive: input.includeInactive ? undefined : true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        sortOrder: true,
        isSystemDefault: true,
      },
    });

    return { items };
  });
