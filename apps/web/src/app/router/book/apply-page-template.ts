import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

// Define o layout próprio de UMA página. `templateId` null limpa o layout
// próprio e faz a página voltar a seguir o layout do book. Cópia por valor:
// editar o padrão depois não mexe nas páginas já montadas.
export const applyBookPageTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      itemId: z.string(),
      templateId: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const item = await prisma.bookItem.findFirst({
      where: { id: input.itemId, book: { organizationId: context.org.id } },
      select: { id: true },
    });
    if (!item) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    if (!input.templateId) {
      await prisma.bookItem.update({
        where: { id: item.id },
        data: { pageLayout: Prisma.DbNull, pageBackground: Prisma.DbNull },
      });
      return { success: true as const, cleared: true as const };
    }

    const template = await prisma.bookPageTemplate.findFirst({
      where: { id: input.templateId, organizationId: context.org.id },
      select: { layout: true, background: true },
    });
    if (!template) throw errors.NOT_FOUND({ message: "Padrão não encontrado" });

    await prisma.bookItem.update({
      where: { id: item.id },
      data: {
        pageLayout: template.layout ?? Prisma.DbNull,
        pageBackground: template.background ?? Prisma.DbNull,
      },
    });

    return { success: true as const, cleared: false as const };
  });
