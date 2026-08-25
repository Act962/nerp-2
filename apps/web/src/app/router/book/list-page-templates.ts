import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Padrões de UMA página. Com `supplierId`, devolve os daquela indústria mais
// os da organização, que servem para qualquer book.
export const listBookPageTemplates = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ supplierId: z.string().nullable().optional() }))
  .handler(async ({ input, context }) => {
    const templates = await prisma.bookPageTemplate.findMany({
      where: {
        organizationId: context.org.id,
        OR: input.supplierId
          ? [{ supplierId: input.supplierId }, { supplierId: null }]
          : [{ supplierId: null }],
      },
      orderBy: [{ supplierId: "desc" }, { name: "asc" }],
      include: { supplier: { select: { name: true } } },
    });

    return {
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        supplierId: template.supplierId,
        supplierName: template.supplier?.name ?? null,
        layout: template.layout,
        background: template.background,
        updatedAt: template.updatedAt.toISOString(),
      })),
    };
  });
