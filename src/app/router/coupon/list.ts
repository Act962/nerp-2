import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const listCouponsAdmin = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => {
    const coupons = await prisma.coupon.findMany({
      where: { organizationId: context.org.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        value: true,
        isActive: true,
        funderSupplierId: true,
        startsAt: true,
        endsAt: true,
        _count: { select: { redemptions: true } },
      },
    });

    return coupons.map((coupon) => ({
      id: coupon.id,
      title: coupon.title,
      type: coupon.type,
      value: Number(coupon.value),
      isActive: coupon.isActive,
      sponsored: coupon.funderSupplierId !== null,
      startsAt: coupon.startsAt?.toISOString() ?? null,
      endsAt: coupon.endsAt?.toISOString() ?? null,
      redemptions: coupon._count.redemptions,
    }));
  });
