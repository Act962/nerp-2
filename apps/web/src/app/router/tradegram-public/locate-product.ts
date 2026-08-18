import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolvePublicStore } from "./_resolve-public-store";

// "Onde está?" — dado o código de barras, acha a gôndola do produto NESTA loja
// via a única ponte mapa↔produto: PlanogramItem → PlanogramFixture(mapObjectId)
// → MapObject (do floor plan da loja). Devolve o mapObjectId pro cliente chamar
// focusObject e destacar no mapa público.
export const locateProduct = base
  .route({ method: "GET", summary: "Localizar produto no mapa da loja" })
  .input(
    z.object({
      orgSlug: z.string().min(1),
      storeId: z.string().min(1),
      barcode: z.string().min(1),
    }),
  )
  .handler(async ({ input, errors }) => {
    const { organizationId, storeId } = await resolvePublicStore(
      input.orgSlug,
      input.storeId,
      errors,
    );

    const product = await prisma.product.findFirst({
      where: { organizationId, barcode: input.barcode.trim() },
      select: { id: true },
    });
    if (!product) return { found: false as const };

    const fixture = await prisma.planogramFixture.findFirst({
      where: {
        organizationId,
        mapObjectId: { not: null },
        mapObject: { floorPlan: { storeId } },
        planogram: { items: { some: { productId: product.id } } },
      },
      select: {
        mapObjectId: true,
        mapObject: {
          select: {
            name: true,
            sectorId: true,
            sector: { select: { name: true } },
          },
        },
      },
    });
    if (!fixture?.mapObjectId) return { found: false as const };

    return {
      found: true as const,
      mapObjectId: fixture.mapObjectId,
      objectName: fixture.mapObject?.name ?? null,
      sectorId: fixture.mapObject?.sectorId ?? null,
      sectorName: fixture.mapObject?.sector?.name ?? null,
    };
  });
