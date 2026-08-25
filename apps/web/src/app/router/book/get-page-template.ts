import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Um único BookPageTemplate — usado pelo editor standalone em /padroes/[id].
export const getBookPageTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const template = await prisma.bookPageTemplate.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      include: { supplier: { select: { id: true, name: true } } },
    });
    if (!template) {
      throw errors.NOT_FOUND({ message: "Padrão não encontrado" });
    }
    return {
      id: template.id,
      name: template.name,
      supplierId: template.supplierId,
      supplierName: template.supplier?.name ?? null,
      layout: template.layout,
      background: template.background,
      updatedAt: template.updatedAt.toISOString(),
    };
  });
