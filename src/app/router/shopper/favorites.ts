import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolvePublicOrg } from "../tradegram-public/_resolve-public-store";
import { assertShopper } from "./_assert-shopper";

function currentPrice(salePrice: unknown, promotionalPrice: unknown): number {
  return promotionalPrice !== null && promotionalPrice !== undefined
    ? Number(promotionalPrice)
    : Number(salePrice);
}

// Favoritar/desfavoritar (por código de barras) — requer login. Grava o preço
// do momento pra depois mostrar "baixou X%".
export const favoriteToggle = base
  .route({ method: "POST", summary: "Favoritar produto" })
  .input(
    z.object({
      token: z.string().optional(),
      orgSlug: z.string().min(1),
      storeId: z.string().optional(),
      barcode: z.string().min(1),
    }),
  )
  .handler(async ({ input, errors }) => {
    const shopperId = await assertShopper(input.token, errors);
    const organizationId = await resolvePublicOrg(input.orgSlug, errors);

    const product = await prisma.product.findFirst({
      where: { organizationId, barcode: input.barcode.trim() },
      select: { id: true, salePrice: true, promotionalPrice: true },
    });
    if (!product) throw errors.NOT_FOUND({ message: "Produto não encontrado" });

    const existing = await prisma.favorite.findUnique({
      where: { shopperId_productId: { shopperId, productId: product.id } },
      select: { id: true },
    });
    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    }

    await prisma.favorite.create({
      data: {
        shopperId,
        organizationId,
        productId: product.id,
        storeId: input.storeId || null,
        priceWhenFavorited: currentPrice(
          product.salePrice,
          product.promotionalPrice,
        ),
      },
    });
    return { favorited: true };
  });

export const isFavorite = base
  .route({ method: "GET", summary: "Produto está favoritado?" })
  .input(
    z.object({
      token: z.string().optional(),
      orgSlug: z.string().min(1),
      barcode: z.string().min(1),
    }),
  )
  .handler(async ({ input, errors }) => {
    const shopperId = await assertShopper(input.token, errors);
    const organizationId = await resolvePublicOrg(input.orgSlug, errors);
    const product = await prisma.product.findFirst({
      where: { organizationId, barcode: input.barcode.trim() },
      select: { id: true },
    });
    if (!product) return { favorited: false };
    const favorite = await prisma.favorite.findUnique({
      where: { shopperId_productId: { shopperId, productId: product.id } },
      select: { id: true },
    });
    return { favorited: Boolean(favorite) };
  });

export const favoritesList = base
  .route({ method: "GET", summary: "Meus favoritos" })
  .input(z.object({ token: z.string().optional() }))
  .handler(async ({ input, errors }) => {
    const shopperId = await assertShopper(input.token, errors);
    const favorites = await prisma.favorite.findMany({
      where: { shopperId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        storeId: true,
        priceWhenFavorited: true,
        product: {
          select: {
            barcode: true,
            name: true,
            thumbnail: true,
            salePrice: true,
            promotionalPrice: true,
            organization: { select: { slug: true } },
          },
        },
      },
    });

    return favorites.map((favorite) => {
      const price = currentPrice(
        favorite.product.salePrice,
        favorite.product.promotionalPrice,
      );
      const base = Number(favorite.priceWhenFavorited);
      const dropPct =
        base > 0 && price < base ? Math.round((1 - price / base) * 100) : null;
      return {
        id: favorite.id,
        barcode: favorite.product.barcode,
        name: favorite.product.name,
        thumbnail: favorite.product.thumbnail || null,
        orgSlug: favorite.product.organization.slug,
        storeId: favorite.storeId,
        price,
        priceWhenFavorited: base,
        dropPct,
      };
    });
  });
