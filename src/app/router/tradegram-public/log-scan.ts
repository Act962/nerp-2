import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolvePublicStore } from "./_resolve-public-store";

// Registra um evento de comportamento do shopper (anônimo). Denormaliza
// brand/supplier no servidor a partir do produto para o rollup da Fase D nunca
// re-juntar — e para nunca devolver esses ids ao cliente. Fire-and-forget do
// lado do cliente. TODO: rate-limit por anonId+IP (precisa de store — Fase B).
export const logScan = base
  .route({ method: "POST", summary: "Registrar evento do shopper" })
  .input(
    z.object({
      orgSlug: z.string().min(1),
      storeId: z.string().min(1),
      anonId: z.string().min(1).max(64),
      kind: z.enum([
        "BARCODE_SCAN",
        "PRODUCT_SEARCH",
        "SECTOR_VIEW",
        "LOCATE",
        "UNKNOWN_BARCODE",
      ]),
      barcode: z.string().max(64).optional(),
      productId: z.string().max(64).optional(),
      sectorId: z.string().max(64).optional(),
      query: z.string().max(200).optional(),
      matched: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const { organizationId, storeId } = await resolvePublicStore(
      input.orgSlug,
      input.storeId,
      errors,
    );

    let productId = input.productId ?? null;
    let brandId: string | null = null;
    let supplierId: string | null = null;

    if (!productId && input.barcode) {
      const product = await prisma.product.findFirst({
        where: { organizationId, barcode: input.barcode.trim() },
        select: { id: true, brandId: true, supplierId: true },
      });
      if (product) {
        productId = product.id;
        brandId = product.brandId;
        supplierId = product.supplierId;
      }
    } else if (productId) {
      const product = await prisma.product.findFirst({
        where: { organizationId, id: productId },
        select: { brandId: true, supplierId: true },
      });
      if (product) {
        brandId = product.brandId;
        supplierId = product.supplierId;
      } else {
        productId = null; // id forjado não entra
      }
    }

    await prisma.scanEvent.create({
      data: {
        organizationId,
        storeId,
        kind: input.kind,
        barcode: input.barcode?.trim() || null,
        productId,
        brandId,
        supplierId,
        sectorId: input.sectorId || null,
        query: input.query?.trim() || null,
        matched: input.matched ?? Boolean(productId),
        anonId: input.anonId,
      },
    });

    return { ok: true };
  });
