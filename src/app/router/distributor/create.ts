import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";
import { z } from "zod";

export const distributorInput = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(160),
  document: z.string().trim().max(40).optional(),
  contactName: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  contactEmail: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
  isActive: z.boolean().optional(),
});

export const createDistributor = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(distributorInput)
  .handler(async ({ input, context, errors }) => {
    const actor = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true },
    });
    if (!hasFullAccess(actor?.role)) {
      throw errors.FORBIDDEN({
        message: "Sem permissão para criar distribuidor",
      });
    }

    const distributor = await prisma.distributor.create({
      data: {
        organizationId: context.org.id,
        name: input.name,
        document: input.document || undefined,
        contactName: input.contactName || undefined,
        contactPhone: input.contactPhone || undefined,
        contactEmail: input.contactEmail || undefined,
        notes: input.notes || undefined,
        isActive: input.isActive ?? true,
      },
      select: { id: true },
    });

    return { id: distributor.id };
  });
