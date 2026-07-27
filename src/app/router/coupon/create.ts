import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";
import { z } from "zod";

const toDate = (value?: string) => (value ? new Date(value) : null);

export const createCoupon = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      title: z.string().trim().min(2).max(120),
      type: z.enum(["PERCENT", "FIXED"]),
      value: z.number().positive(),
      productId: z.string().optional(),
      barcode: z.string().optional(),
      brandId: z.string().optional(),
      categoryId: z.string().optional(),
      funderSupplierId: z.string().optional(),
      minQty: z.number().int().min(1).optional(),
      startsAt: z.string().optional(),
      endsAt: z.string().optional(),
      maxRedemptions: z.number().int().min(1).optional(),
      perShopperLimit: z.number().int().min(1).default(1),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const actor = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true },
    });
    if (!hasFullAccess(actor?.role)) {
      throw errors.FORBIDDEN({ message: "Sem permissão para criar cupom" });
    }

    // Alvo por código de barras (opcional) → resolve o produto da própria org.
    let productId = input.productId || null;
    if (!productId && input.barcode?.trim()) {
      const product = await prisma.product.findFirst({
        where: {
          organizationId: context.org.id,
          barcode: input.barcode.trim(),
        },
        select: { id: true },
      });
      if (!product) {
        throw errors.NOT_FOUND({ message: "Produto do código não encontrado" });
      }
      productId = product.id;
    }

    const coupon = await prisma.coupon.create({
      data: {
        organizationId: context.org.id,
        title: input.title,
        type: input.type,
        value: input.value,
        productId,
        brandId: input.brandId || null,
        categoryId: input.categoryId || null,
        funderSupplierId: input.funderSupplierId || null,
        minQty: input.minQty ?? null,
        startsAt: toDate(input.startsAt),
        endsAt: toDate(input.endsAt),
        maxRedemptions: input.maxRedemptions ?? null,
        perShopperLimit: input.perShopperLimit,
      },
      select: { id: true },
    });

    return { id: coupon.id };
  });
