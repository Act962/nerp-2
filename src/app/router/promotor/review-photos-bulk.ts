import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { z } from "zod";

// Aprova/reprova VÁRIAS fotos do promotor de uma vez (ação em massa da visão
// "Por foto"). Mesma permissão do review individual ("books-aprovar"). Só toca
// nas fotos que são da org — os ids de fora são ignorados pelo where.
export const reviewPromotorPhotosBulk = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      photoIds: z.array(z.string()).min(1).max(500),
      status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
      note: z.string().max(500).nullable().optional(),
    }),
  )
  .output(z.object({ count: z.number() }))
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

    const reviewing = input.status !== "PENDING";
    const result = await prisma.pdvPhoto.updateMany({
      where: {
        id: { in: input.photoIds },
        organizationId: context.org.id,
        promoterName: { not: null },
      },
      data: {
        approvalStatus: input.status,
        approvalNote: input.status === "REJECTED" ? (input.note ?? null) : null,
        reviewedById: reviewing ? context.user.id : null,
        reviewedByName: reviewing ? (context.user.name ?? null) : null,
        reviewedAt: reviewing ? new Date() : null,
      },
    });

    return { count: result.count };
  });
