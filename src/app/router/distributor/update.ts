import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { normalizeDocument } from "@/lib/document";
import { hasFullAccess } from "@/lib/permissions";
import { z } from "zod";
import { distributorInput } from "./create";

export const updateDistributor = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(distributorInput.extend({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const actor = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true },
    });
    if (!hasFullAccess(actor?.role)) {
      throw errors.FORBIDDEN({
        message: "Sem permissão para editar distribuidor",
      });
    }

    const distributor = await prisma.distributor.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!distributor)
      throw errors.NOT_FOUND({ message: "Distribuidor não encontrado" });

    await prisma.distributor.update({
      where: { id: distributor.id },
      data: {
        name: input.name,
        document: normalizeDocument(input.document) ?? input.document ?? null,
        contactName: input.contactName || null,
        contactPhone: input.contactPhone || null,
        contactEmail: input.contactEmail || null,
        notes: input.notes || null,
        isActive: input.isActive ?? true,
      },
    });

    return { id: distributor.id };
  });
