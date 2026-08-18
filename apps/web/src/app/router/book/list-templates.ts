import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Padrões visuais salvos. Sem `supplierId` devolve os padrões da organização
// (supplierId null); com, devolve os daquela indústria mais os da organização,
// que servem de base pra copiar.
export const listBookTemplates = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ supplierId: z.string().nullable().optional() }))
  .handler(async ({ input, context }) => {
    const templates = await prisma.bookTemplate.findMany({
      where: {
        organizationId: context.org.id,
        OR: input.supplierId
          ? [{ supplierId: input.supplierId }, { supplierId: null }]
          : [{ supplierId: null }],
      },
      orderBy: [{ supplierId: "desc" }, { isDefault: "desc" }, { name: "asc" }],
      include: { supplier: { select: { id: true, name: true } } },
    });

    return {
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        supplierId: template.supplierId,
        supplierName: template.supplier?.name ?? null,
        isDefault: template.isDefault,
        coverLayout: template.coverLayout,
        closingLayout: template.closingLayout,
        pageLayout: template.pageLayout,
        coverBackground: template.coverBackground,
        closingBackground: template.closingBackground,
        pageBackground: template.pageBackground,
        updatedAt: template.updatedAt.toISOString(),
      })),
    };
  });
