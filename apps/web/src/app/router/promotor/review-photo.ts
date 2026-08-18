import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { z } from "zod";

// Coordenadora aprova/reprova a foto do promotor (QC antes de entrar no book).
// Mesma permissão de aprovar books ("books-aprovar").
export const reviewPromotorPhoto = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      photoId: z.string(),
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

    const photo = await prisma.pdvPhoto.findFirst({
      where: { id: input.photoId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!photo) throw errors.NOT_FOUND({ message: "Foto não encontrada" });

    const reviewing = input.status !== "PENDING";
    await prisma.pdvPhoto.update({
      where: { id: photo.id },
      data: {
        approvalStatus: input.status,
        approvalNote: input.status === "REJECTED" ? (input.note ?? null) : null,
        reviewedById: reviewing ? context.user.id : null,
        reviewedByName: reviewing ? (context.user.name ?? null) : null,
        reviewedAt: reviewing ? new Date() : null,
        // Aprovar consome a foto: sai da Galeria App. Reabrir/reprovar devolve.
        consumedAt: input.status === "APPROVED" ? new Date() : null,
      },
    });

    return { success: true as const, status: input.status };
  });
