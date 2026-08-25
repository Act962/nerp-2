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

// Edita o layout próprio de UMA página, sem passar por padrão. `pageLayout`
// null faz a página voltar a seguir o layout do book.
export const updateBookItemLayout = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      itemId: z.string(),
      pageLayout: nullableCoverLayoutSchema,
      pageBackground: nullableCoverBackgroundSchema,
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const item = await prisma.bookItem.findFirst({
      where: { id: input.itemId, book: { organizationId: context.org.id } },
      select: { id: true },
    });
    if (!item) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    await prisma.bookItem.update({
      where: { id: item.id },
      data: {
        pageLayout: input.pageLayout ?? Prisma.DbNull,
        pageBackground: input.pageBackground ?? Prisma.DbNull,
      },
    });

    return { success: true as const };
  });
