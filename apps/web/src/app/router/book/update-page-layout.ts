import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";
import {
  nullableCoverBackgroundSchema,
  nullableCoverLayoutSchema,
} from "./cover-layout-schema";

export const updateBookPageLayout = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      // null volta o book pro layout fixo legado das páginas de PDV.
      pageLayout: nullableCoverLayoutSchema,
      pageBackground: nullableCoverBackgroundSchema,
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const book = await prisma.book.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!book) {
      throw errors.NOT_FOUND({ message: "Book não encontrado" });
    }

    return prisma.book.update({
      where: { id: input.id },
      data: {
        // Prisma.DbNull grava NULL na coluna; `undefined` seria "não alterar",
        // e aí o botão de voltar ao layout padrão não teria efeito.
        pageLayout: input.pageLayout ?? Prisma.DbNull,
        pageBackground: input.pageBackground ?? Prisma.DbNull,
      },
      select: { id: true },
    });
  });
