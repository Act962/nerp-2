import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Rascunhos da "Galeria App" do promotor logado: fotos tiradas dentro do app
// (câmera) ainda NÃO enviadas pra aprovação (submittedAt null) e não consumidas.
// Alimenta o picker do passo 3/3 "Adicionar da Galeria App". Filtro opcional por
// loja+indústria mantém a integridade (foto de uma gôndola não vai pra outra).
export const listGalleryDrafts = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      storeId: z.string().optional(),
      supplierId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const photos = await prisma.pdvPhoto.findMany({
      where: {
        organizationId: context.org.id,
        createdById: context.user.id,
        submittedAt: null,
        consumedAt: null,
        ...(input.storeId ? { storeId: input.storeId } : {}),
        ...(input.supplierId ? { supplierId: input.supplierId } : {}),
      },
      orderBy: { capturedAt: "desc" },
      take: 120,
      select: {
        id: true,
        photos: true,
        capturedAt: true,
        capturedCity: true,
        capturedState: true,
        possibleReuse: true,
        storeId: true,
        supplierId: true,
        store: { select: { name: true } },
        supplier: { select: { name: true } },
      },
    });

    return {
      photos: photos
        .filter((photo) => photo.photos[0])
        .map((photo) => ({
          id: photo.id,
          photoKey: photo.photos[0],
          capturedAt: photo.capturedAt.toISOString(),
          capturedCity: photo.capturedCity,
          capturedState: photo.capturedState,
          possibleReuse: photo.possibleReuse,
          storeId: photo.storeId,
          supplierId: photo.supplierId,
          storeName: photo.store.name,
          supplierName: photo.supplier?.name ?? null,
        })),
    };
  });
