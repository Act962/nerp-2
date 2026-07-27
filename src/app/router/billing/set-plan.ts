import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";
import { z } from "zod";

// Define/atualiza o plano de trade da org. Só owner/admin. Como a cobrança real
// (Stripe/Asaas) ainda não está plugada, o status entra como CORTESIA — a
// transação de pagamento é o próximo passo. `cancel` derruba o acesso pago.
export const setBillingPlan = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      plan: z.enum(["BRONZE", "PRATA", "OURO"]),
      cancel: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const actor = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true },
    });
    if (!hasFullAccess(actor?.role)) {
      throw errors.FORBIDDEN({
        message: "Só o dono/admin pode alterar o plano",
      });
    }

    const status = input.cancel ? "CANCELADA" : "CORTESIA";

    await prisma.tradeSubscription.upsert({
      where: { organizationId: context.org.id },
      create: {
        organizationId: context.org.id,
        plan: input.plan,
        status,
      },
      update: {
        plan: input.plan,
        status,
      },
    });

    return { plan: input.plan, status };
  });
