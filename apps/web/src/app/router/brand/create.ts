import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const createBrand = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      supplierId: z.string(),
      name: z.string().min(1, "Informe o nome da marca"),
      logo: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string(), name: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, organizationId: context.org.id },
      select: { id: true },
    });

    if (!supplier) {
      throw errors.NOT_FOUND({ message: "Indústria não encontrada" });
    }

    const brand = await prisma.brand.create({
      data: {
        organizationId: context.org.id,
        supplierId: input.supplierId,
        name: input.name,
        logo: input.logo,
      },
    });

    return { id: brand.id, name: brand.name };
  });
