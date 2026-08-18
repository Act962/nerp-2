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

// Edita o layout próprio de uma BookPage (modelo novo). null volta a página
// a herdar o layout do book / cair no BookPagePhotoGrid legado.
export const updateBookPageOwnLayout = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      bookPageId: z.string(),
      pageLayout: nullableCoverLayoutSchema,
      pageBackground: nullableCoverBackgroundSchema,
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const page = await prisma.bookPage.findFirst({
      where: {
        id: input.bookPageId,
        book: { organizationId: context.org.id },
      },
      select: { id: true },
    });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    await prisma.bookPage.update({
      where: { id: page.id },
      data: {
        pageLayout: input.pageLayout ?? Prisma.DbNull,
        pageBackground: input.pageBackground ?? Prisma.DbNull,
      },
    });

    return { success: true as const };
  });
