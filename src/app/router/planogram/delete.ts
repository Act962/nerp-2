import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const deletePlanogram = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const planogram = await prisma.planogram.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!planogram) {
      throw errors.NOT_FOUND({ message: "Planograma não encontrado" });
    }

    // Cascade no schema derruba fixtures → modules → shelves → items.
    return prisma.planogram.delete({ where: { id: input.id } });
  });
