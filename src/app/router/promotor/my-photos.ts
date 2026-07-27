import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Fotos do promotor logado, com o status de aprovação da coordenadora (agora no
// nível da própria foto). Reprovadas mostram o motivo pra ele refazer.
export const listMyPromotorPhotos = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      status: z.enum(["ALL", "APPROVED", "REJECTED", "PENDING"]).default("ALL"),
    }),
  )
  .handler(async ({ input, context }) => {
    const photos = await prisma.pdvPhoto.findMany({
      where: {
        organizationId: context.org.id,
        createdById: context.user.id,
        ...(input.status === "ALL" ? {} : { approvalStatus: input.status }),
      },
      orderBy: { capturedAt: "desc" },
      select: {
        id: true,
        photos: true,
        code: true,
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
      where: { organizationId: context.org.id, createdById: context.user.id },
      _count: true,
    });
    const countBy = (status: string) =>
      counts.find((row) => row.approvalStatus === status)?._count ?? 0;
    const total = counts.reduce((sum, row) => sum + row._count, 0);

    return {
      photos: photos.map((photo) => ({
        id: photo.id,
        photoKey: photo.photos[0] ?? null,
        code: photo.code,
        capturedAt: photo.capturedAt.toISOString(),
        capturedCity: photo.capturedCity,
        capturedState: photo.capturedState,
        storeName: photo.store.name,
        supplierName: photo.supplier?.name ?? null,
        status: photo.approvalStatus,
        rejectionNote:
          photo.approvalStatus === "REJECTED" ? photo.approvalNote : null,
      })),
      counts: {
        all: total,
        approved: countBy("APPROVED"),
        rejected: countBy("REJECTED"),
        pending: countBy("PENDING"),
      },
    };
  });
