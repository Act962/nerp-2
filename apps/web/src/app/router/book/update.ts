import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const updateBook = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      supplierId: z.string().optional(),
      periodMonth: z.number().int().min(1).max(12).optional(),
      periodYear: z.number().int().min(2000).max(2100).optional(),
      distributorLogo: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id, ...data } = input;

    const book = await prisma.book.findFirst({
      where: { id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!book) {
      throw errors.NOT_FOUND({ message: "Book não encontrado" });
    }

    return prisma.book.update({ where: { id }, data, select: { id: true } });
  });
