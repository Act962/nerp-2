import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

export const deleteSupplier = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id } = input;
    const supplier = await prisma.supplier.findFirst({
      where: { id, organizationId: context.org.id },
    });

    if (!supplier) {
      throw errors.NOT_FOUND({
        message: "Fornecedor não encontrado",
      });
    }

    return await prisma.supplier.delete({ where: { id } });
  });
