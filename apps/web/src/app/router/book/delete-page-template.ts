import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const deleteBookPageTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const template = await prisma.bookPageTemplate.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!template) {
      throw errors.NOT_FOUND({ message: "Padrão de página não encontrado" });
    }

    await prisma.bookPageTemplate.delete({ where: { id: template.id } });
    return { success: true as const };
  });
