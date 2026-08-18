import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const deleteMapAnnotation = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    await prisma.mapAnnotation.deleteMany({
      where: { id: input.id, organizationId: context.org.id },
    });

    return { success: true };
  });
