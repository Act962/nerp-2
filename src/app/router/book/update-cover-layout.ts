import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import {
  coverBackgroundSchema,
  coverLayoutSchema,
} from "./cover-layout-schema";

export const updateBookCoverLayout = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      coverLayout: coverLayoutSchema,
      closingLayout: coverLayoutSchema,
      coverBackground: coverBackgroundSchema,
      closingBackground: coverBackgroundSchema,
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
        coverLayout: input.coverLayout,
        closingLayout: input.closingLayout,
        coverBackground: input.coverBackground,
        closingBackground: input.closingBackground,
      },
      select: { id: true },
    });
  });
