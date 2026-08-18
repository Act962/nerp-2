import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const createBook = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string().min(1, "Informe o nome do book"),
      supplierId: z.string().optional(),
      periodMonth: z.number().int().min(1).max(12),
      periodYear: z.number().int().min(2000).max(2100),
      distributorLogo: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (input.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: input.supplierId, organizationId: context.org.id },
        select: { id: true },
      });
      if (!supplier) {
        throw errors.NOT_FOUND({ message: "Indústria não encontrada" });
      }
    }

    const book = await prisma.book.create({
      data: {
        organizationId: context.org.id,
        name: input.name,
        supplierId: input.supplierId,
        periodMonth: input.periodMonth,
        periodYear: input.periodYear,
        distributorLogo: input.distributorLogo,
        createdById: context.user.id,
      },
      select: { id: true },
    });

    return { id: book.id };
  });
