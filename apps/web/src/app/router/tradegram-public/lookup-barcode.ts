import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolvePublicStore } from "./_resolve-public-store";

const MIN_BARCODE_LENGTH = 8; // EAN-8 é o menor código real

// Escaneou/digitou um código de barras no app do cliente → preço/oferta/info.
// Público (sem login). ALLOWLIST explícita: só campos de vitrine, nada comercial
// (custo, fornecedor, estoque). Preço é por org hoje (priceScope="ORG"); o
// override por loja entra na Fase C sem mudar este contrato.
export const lookupBarcode = base
  .route({ method: "GET", summary: "Buscar produto por código de barras" })
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

    const barcode = input.barcode.trim();
    if (!/^\d+$/.test(barcode) || barcode.length < MIN_BARCODE_LENGTH) {
      return { found: false as const };
    }

    const product = await prisma.product.findFirst({
      where: { organizationId, isActive: true, barcode },
      select: {
        id: true,
        name: true,
        thumbnail: true,
        images: true,
        salePrice: true,
        promotionalPrice: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
      },
    });
    if (!product) return { found: false as const };

    // Override por loja (Fase C) tem prioridade; senão cai no preço da org.
    const override = await prisma.storeProduct.findUnique({
      where: { storeId_productId: { storeId, productId: product.id } },
      select: { salePrice: true, promotionalPrice: true },
    });
    const priceScope: "STORE" | "ORG" =
      override &&
      (override.salePrice !== null || override.promotionalPrice !== null)
        ? "STORE"
        : "ORG";
    const salePrice = Number(override?.salePrice ?? product.salePrice);
    const rawPromo = override?.promotionalPrice ?? product.promotionalPrice;
    const promotionalPrice = rawPromo !== null ? Number(rawPromo) : null;
    const discount =
      promotionalPrice && salePrice > 0
        ? Math.round((1 - promotionalPrice / salePrice) * 100)
        : null;
    const savings =
      promotionalPrice !== null
        ? Number((salePrice - promotionalPrice).toFixed(2))
        : null;

    return {
      found: true as const,
      product: {
        id: product.id,
        name: product.name,
        thumbnail: product.thumbnail || null,
        images: product.images,
        brandName: product.brand?.name ?? null,
        categoryName: product.category?.name ?? null,
        salePrice,
        promotionalPrice,
        discount,
        savings,
        priceScope,
      },
    };
  });
