import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

const TEMPLATE_FIELDS = {
  id: true,
  name: true,
  supplierId: true,
  isDefault: true,
  coverLayout: true,
  closingLayout: true,
  pageLayout: true,
  coverBackground: true,
  closingBackground: true,
  pageBackground: true,
} as const;

// Layout que pré-preenche o editor de um book que ainda não tem o próprio.
// Cascata: padrão da indústria → padrão da organização → template legado.
// A indústria sem padrão nasce copiando o da organização, mas a cópia é por
// valor: a partir do primeiro save ela fica independente.
export const getTemplateForBook = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ supplierId: z.string().nullable().optional() }))
  .handler(async ({ input, context }) => {
    if (input.supplierId) {
      const supplierTemplate = await prisma.bookTemplate.findFirst({
        where: {
          organizationId: context.org.id,
          supplierId: input.supplierId,
        },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: TEMPLATE_FIELDS,
      });
      if (supplierTemplate) {
        return { source: "supplier" as const, ...supplierTemplate };
      }
    }

    const orgTemplate = await prisma.bookTemplate.findFirst({
      where: { organizationId: context.org.id, supplierId: null },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: TEMPLATE_FIELDS,
    });
    if (orgTemplate) {
      return { source: "organization" as const, ...orgTemplate };
    }

    const legacy = await prisma.bookCoverTemplate.findUnique({
      where: { organizationId: context.org.id },
      select: {
        id: true,
        coverLayout: true,
        closingLayout: true,
        coverBackground: true,
        closingBackground: true,
      },
    });
    if (!legacy) return null;

    return {
      source: "organization" as const,
      id: legacy.id,
      name: "Padrão da organização",
      supplierId: null,
      isDefault: true,
      coverLayout: legacy.coverLayout,
      closingLayout: legacy.closingLayout,
      pageLayout: null,
      coverBackground: legacy.coverBackground,
      closingBackground: legacy.closingBackground,
      pageBackground: null,
    };
  });
