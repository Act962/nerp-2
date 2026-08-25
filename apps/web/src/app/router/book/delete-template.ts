import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const deleteBookTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const template = await prisma.bookTemplate.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!template) {
      throw errors.NOT_FOUND({ message: "Padrão não encontrado" });
    }

    await prisma.bookTemplate.delete({ where: { id: template.id } });
    return { success: true as const };
  });
