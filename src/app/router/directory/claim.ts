import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";
import { z } from "zod";

// Reivindica uma empresa do diretório para a org atual. Só owner/admin.
// - Livre → APROVADA na hora (first-claim-wins), liga a empresa à org.
// - Já da sua org → sem mudança (já é sua).
// - De outra org → CONTESTADA (disputa registrada para resolução futura).
export const claimDirectoryCompany = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      companyId: z.string(),
      claimantRole: z.string().trim().max(120).optional(),
      contactEmail: z.string().trim().max(160).optional(),
      document: z.string().trim().max(40).optional(),
      notes: z.string().trim().max(1000).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const actor = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true },
    });
    if (!hasFullAccess(actor?.role)) {
      throw errors.FORBIDDEN({
        message: "Só o dono/admin pode reivindicar uma empresa",
      });
    }

    const company = await prisma.directoryCompany.findUnique({
      where: { id: input.companyId },
      select: { id: true, claimedByOrgId: true },
    });
    if (!company) throw errors.NOT_FOUND({ message: "Empresa não encontrada" });

    if (company.claimedByOrgId === context.org.id) {
      return { status: "APROVADA" as const, alreadyMine: true };
    }

    const isContested = company.claimedByOrgId !== null;
    const status = isContested ? "CONTESTADA" : "APROVADA";

    await prisma.$transaction(async (tx) => {
      await tx.companyClaim.create({
        data: {
          companyId: company.id,
          organizationId: context.org.id,
          requestedByUserId: context.user.id,
          status,
          claimantRole: input.claimantRole || undefined,
          contactEmail: input.contactEmail || undefined,
          document: input.document || undefined,
          notes: input.notes || undefined,
          resolvedAt: status === "APROVADA" ? new Date() : undefined,
        },
      });
      if (!isContested) {
        await tx.directoryCompany.update({
          where: { id: company.id },
          data: { claimedByOrgId: context.org.id, claimedAt: new Date() },
        });
      }
    });

    return { status, alreadyMine: false };
  });
