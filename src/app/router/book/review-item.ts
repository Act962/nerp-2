import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { z } from "zod";

// Aprovação/reprovação da foto de uma página pela coordenadora. Gated pela
// permissão de ação "books-aprovar" (owner/admin sempre podem).
export const reviewBookItem = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      itemId: z.string(),
      status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
      note: z.string().max(500).nullable().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true, permissions: true },
    });
    if (!memberCan(member, "books-aprovar")) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para aprovar fotos",
      });
    }

    const item = await prisma.bookItem.findFirst({
      where: { id: input.itemId, book: { organizationId: context.org.id } },
      select: { id: true },
    });
    if (!item) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    const reviewing = input.status !== "PENDING";
    await prisma.bookItem.update({
      where: { id: item.id },
      data: {
        approvalStatus: input.status,
        approvalNote: input.status === "REJECTED" ? (input.note ?? null) : null,
        reviewedById: reviewing ? context.user.id : null,
        reviewedByName: reviewing ? (context.user.name ?? null) : null,
        reviewedAt: reviewing ? new Date() : null,
      },
    });

    return { success: true as const, status: input.status };
  });
