import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { z } from "zod";

// Lista de fotos dos promotores para a coordenadora revisar. Só fotos vindas do
// fluxo do promotor (promoterName preenchido).
export const listPhotosForApproval = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      status: z
        .enum(["ALL", "APPROVED", "REJECTED", "PENDING"])
        .default("PENDING"),
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

    const photos = await prisma.pdvPhoto.findMany({
      where: {
        organizationId: context.org.id,
        promoterName: { not: null },
        ...(input.status === "ALL" ? {} : { approvalStatus: input.status }),
      },
      orderBy: { capturedAt: "desc" },
      select: {
        id: true,
        photos: true,
        code: true,
        promoterName: true,
        capturedAt: true,
        capturedCity: true,
        capturedState: true,
        approvalStatus: true,
        approvalNote: true,
        store: { select: { name: true } },
        supplier: { select: { name: true } },
      },
    });

    const counts = await prisma.pdvPhoto.groupBy({
      by: ["approvalStatus"],
      where: { organizationId: context.org.id, promoterName: { not: null } },
      _count: true,
    });
    const countBy = (status: string) =>
      counts.find((row) => row.approvalStatus === status)?._count ?? 0;

    return {
      photos: photos.map((photo) => ({
        id: photo.id,
        photoKey: photo.photos[0] ?? null,
        code: photo.code,
        promoterName: photo.promoterName,
        capturedAt: photo.capturedAt.toISOString(),
        capturedCity: photo.capturedCity,
        capturedState: photo.capturedState,
        storeName: photo.store.name,
        supplierName: photo.supplier?.name ?? null,
        approvalStatus: photo.approvalStatus,
        approvalNote: photo.approvalNote,
      })),
      counts: {
        pending: countBy("PENDING"),
        approved: countBy("APPROVED"),
        rejected: countBy("REJECTED"),
      },
    };
  });
