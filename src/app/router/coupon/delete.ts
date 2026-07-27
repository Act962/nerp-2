import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";
import { z } from "zod";

export const deleteCoupon = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const actor = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true },
    });
    if (!hasFullAccess(actor?.role)) {
      throw errors.FORBIDDEN({ message: "Sem permissão para excluir cupom" });
    }

    const coupon = await prisma.coupon.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!coupon) throw errors.NOT_FOUND({ message: "Cupom não encontrado" });

    await prisma.coupon.delete({ where: { id: coupon.id } });
    return { ok: true };
  });
