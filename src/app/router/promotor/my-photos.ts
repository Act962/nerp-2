import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { capturedAtFilter, dateRangeSchema } from "./_date-range";

// Fotos do promotor logado, com o status de aprovação da coordenadora (agora no
// nível da própria foto). Reprovadas mostram o motivo pra ele refazer.
export const listMyPromotorPhotos = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      status: z.enum(["ALL", "APPROVED", "REJECTED", "PENDING"]).default("ALL"),
      // Recorte vindo da navegação de "Minhas fotos". `supplierId: null` é o
      // grupo "Sem indústria" (dado legado — hoje a captura sempre exige uma).
      storeId: z.string().optional(),
      supplierId: z.string().nullable().optional(),
      ...dateRangeSchema,
    }),
  )
  .handler(async ({ input, context }) => {
    const scope = {
      organizationId: context.org.id,
      createdById: context.user.id,
      ...(input.storeId ? { storeId: input.storeId } : {}),
      ...(input.supplierId !== undefined
        ? { supplierId: input.supplierId }
        : {}),
      ...capturedAtFilter(input.from, input.to),
    };

    const photos = await prisma.pdvPhoto.findMany({
      where: {
        ...scope,
        ...(input.status === "ALL" ? {} : { approvalStatus: input.status }),
      },
      orderBy: { capturedAt: "desc" },
      // Teto de segurança: dentro de um par cliente+indústria isso é histórico
      // de sobra, e impede que um promotor antigo puxe milhares de linhas.
      take: 120,
      select: {
        id: true,
        photos: true,
        code: true,
        capturedAt: true,
        capturedCity: true,
        capturedState: true,
        approvalStatus: true,
        approvalNote: true,
        store: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true, actionCodeImage: true } },
      },
    });

    // Contagens do mesmo recorte, não da conta inteira: com o filtro de status
    // aplicado dentro de um cliente, um número global mentiria sobre o que a
    // lista logo abaixo está mostrando.
    const counts = await prisma.pdvPhoto.groupBy({
      by: ["approvalStatus"],
      where: scope,
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
        storeId: photo.store.id,
        storeName: photo.store.name,
        supplierId: photo.supplier?.id ?? null,
        supplierName: photo.supplier?.name ?? null,
        supplierActionCodeImage: photo.supplier?.actionCodeImage ?? null,
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
