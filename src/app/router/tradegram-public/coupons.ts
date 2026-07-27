import { base } from "@/app/middlewares/base";
import { verifyShopperToken } from "@/features/shopper/lib/shopper-token";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolvePublicStore } from "./_resolve-public-store";

// Cupons ativos que se aplicam ao produto escaneado (por produto/marca/categoria
// ou cupom amplo da org), dentro da janela de validade. Público (ver não exige
// login; resgatar sim).
export const listCoupons = base
  .route({ method: "GET", summary: "Cupons do produto" })
  .input(
    z.object({
      orgSlug: z.string().min(1),
      storeId: z.string().min(1),
      barcode: z.string().min(1),
    }),
  )
  .handler(async ({ input, errors }) => {
    const { organizationId } = await resolvePublicStore(
      input.orgSlug,
      input.storeId,
      errors,
    );

    const product = await prisma.product.findFirst({
      where: { organizationId, barcode: input.barcode.trim() },
      select: { id: true, brandId: true, categoryId: true },
    });
    if (!product) return { coupons: [] };

    const now = new Date();
    const coupons = await prisma.coupon.findMany({
      where: {
        organizationId,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          {
            OR: [
              { productId: product.id },
              { brandId: product.brandId },
              { categoryId: product.categoryId },
              {
                productId: null,
                brandId: null,
                categoryId: null,
              },
            ],
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        type: true,
        value: true,
        minQty: true,
        funderSupplierId: true,
        endsAt: true,
      },
    });

    return {
      coupons: coupons.map((coupon) => ({
        id: coupon.id,
        title: coupon.title,
        type: coupon.type,
        value: Number(coupon.value),
        minQty: coupon.minQty,
        sponsored: coupon.funderSupplierId !== null,
        endsAt: coupon.endsAt?.toISOString() ?? null,
      })),
    };
  });

// Resgata um cupom (requer login). Valida janela, limite global e por shopper.
// Não move dinheiro — só registra o resgate e devolve um código pro caixa.
export const redeemCoupon = base
  .route({ method: "POST", summary: "Resgatar cupom" })
  .input(
    z.object({
      token: z.string().optional(),
      orgSlug: z.string().min(1),
      storeId: z.string().min(1),
      couponId: z.string().min(1),
    }),
  )
  .handler(async ({ input, errors }) => {
    const shopperId = verifyShopperToken(input.token);
    if (!shopperId) throw errors.UNAUTHORIZED({ message: "Faça login" });

    const { organizationId, storeId } = await resolvePublicStore(
      input.orgSlug,
      input.storeId,
      errors,
    );

    const coupon = await prisma.coupon.findFirst({
      where: { id: input.couponId, organizationId, isActive: true },
      select: {
        id: true,
        maxRedemptions: true,
        perShopperLimit: true,
        startsAt: true,
        endsAt: true,
      },
    });
    if (!coupon) throw errors.NOT_FOUND({ message: "Cupom não encontrado" });

    const now = new Date();
    if (
      (coupon.startsAt && coupon.startsAt > now) ||
      (coupon.endsAt && coupon.endsAt < now)
    ) {
      throw errors.BAD_REQUEST({ message: "Cupom fora da validade" });
    }

    const [totalRedemptions, shopperRedemptions] = await Promise.all([
      prisma.couponRedemption.count({ where: { couponId: coupon.id } }),
      prisma.couponRedemption.count({
        where: { couponId: coupon.id, shopperId },
      }),
    ]);
    if (coupon.maxRedemptions && totalRedemptions >= coupon.maxRedemptions) {
      throw errors.BAD_REQUEST({ message: "Cupom esgotado" });
    }
    if (shopperRedemptions >= coupon.perShopperLimit) {
      throw errors.BAD_REQUEST({ message: "Você já resgatou este cupom" });
    }

    const redemption = await prisma.couponRedemption.create({
      data: { couponId: coupon.id, shopperId, storeId },
      select: { id: true },
    });

    return { ok: true, code: redemption.id.slice(-8).toUpperCase() };
  });
