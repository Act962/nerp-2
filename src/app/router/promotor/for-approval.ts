import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { z } from "zod";
import { capturedAtFilter, dateRangeSchema } from "./_date-range";

// Lista de fotos dos promotores para a coordenadora revisar. Só fotos vindas do
// fluxo do promotor (promoterName preenchido).
export const listPhotosForApproval = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      // APP_GALLERY existe só pra alinhar com o tipo compartilhado do promotor;
      // a fila da coordenadora nunca a usa (rascunho não entra aqui).
      status: z
        .enum(["ALL", "APPROVED", "REJECTED", "PENDING", "APP_GALLERY"])
        .default("PENDING"),
      storeId: z.string().optional(),
      supplierId: z.string().nullable().optional(),
      promoterName: z.string().optional(),
      ...dateRangeSchema,
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

    const scope = {
      organizationId: context.org.id,
      promoterName: { not: null },
      // Rascunho da Galeria App (submittedAt null) não aparece pra coordenadora
      // até o promotor enviar.
      submittedAt: { not: null },
      ...(input.storeId ? { storeId: input.storeId } : {}),
      ...(input.supplierId !== undefined
        ? { supplierId: input.supplierId }
        : {}),
      ...(input.promoterName ? { promoterName: input.promoterName } : {}),
      ...capturedAtFilter(input.from, input.to),
    };

    const photos = await prisma.pdvPhoto.findMany({
      where: {
        ...scope,
        ...(input.status === "APPROVED" ||
        input.status === "REJECTED" ||
        input.status === "PENDING"
          ? { approvalStatus: input.status }
          : {}),
      },
      orderBy: { capturedAt: "desc" },
      take: 120,
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
        sealMissing: true,
        possibleReuse: true,
        // Foto original apontada pela suspeita de reuso — a coordenadora compara.
        reuseOf: {
          select: {
            id: true,
            photos: true,
            capturedAt: true,
            promoterName: true,
          },
        },
        offSite: true,
        store: { select: { name: true } },
        supplier: { select: { id: true, name: true, actionCodeImage: true } },
      },
    });

    const counts = await prisma.pdvPhoto.groupBy({
      by: ["approvalStatus"],
      where: scope,
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
        supplierActionCodeImage: photo.supplier?.actionCodeImage ?? null,
        sealMissing: photo.sealMissing,
        offSite: photo.offSite,
        approvalStatus: photo.approvalStatus,
        approvalNote: photo.approvalNote,
        possibleReuse: photo.possibleReuse,
        reuseOf: photo.reuseOf
          ? {
              id: photo.reuseOf.id,
              photoKey: photo.reuseOf.photos[0] ?? null,
              capturedAt: photo.reuseOf.capturedAt.toISOString(),
              promoterName: photo.reuseOf.promoterName,
            }
          : null,
      })),
      counts: {
        pending: countBy("PENDING"),
        approved: countBy("APPROVED"),
        rejected: countBy("REJECTED"),
      },
    };
  });
