import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

// Atualiza layout/background/nome de um BookPageTemplate existente.
// Autosave do editor standalone bate aqui a cada mudança (debounced).
export const updateBookPageTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(80).optional(),
      layout: z.unknown().optional(),
      background: z.unknown().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const template = await prisma.bookPageTemplate.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!template) {
      throw errors.NOT_FOUND({ message: "Padrão não encontrado" });
    }

    const data: Prisma.BookPageTemplateUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.layout !== undefined) {
      data.layout = input.layout as Prisma.InputJsonValue;
    }
    if (input.background !== undefined) {
      data.background =
        input.background === null
          ? Prisma.DbNull
          : (input.background as Prisma.InputJsonValue);
    }

    await prisma.bookPageTemplate.update({
      where: { id: template.id },
      data,
    });

    return { success: true as const };
  });
