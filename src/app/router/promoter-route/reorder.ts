import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolveRoute } from "./_access";

/**
 * Recebe a lista ORDENADA INTEIRA, não um delta.
 *
 * É idempotente, imune a corrida entre dois arrastos seguidos, e permite o
 * servidor exigir que o conjunto enviado seja exatamente o da rota — o que
 * também é a checagem de inquilino, de graça.
 */
export const reorderRoute = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ stopIds: z.array(z.string().min(1)).min(1).max(200) }))
  .output(z.object({ count: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const actor = await resolveRoute(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    const current = await prisma.promoterRouteStop.findMany({
      where: { routeId: actor.routeId, organizationId: context.org.id },
      select: { id: true },
    });

    const sent = new Set(input.stopIds);
    const mine = new Set(current.map((stop) => stop.id));
    const sameSet =
      sent.size === input.stopIds.length &&
      sent.size === mine.size &&
      [...sent].every((id) => mine.has(id));

    if (!sameSet) {
      throw errors.BAD_REQUEST({
        message: "A rota mudou enquanto você reordenava. Recarregue a lista.",
      });
    }

    await prisma.$transaction(
      input.stopIds.map((id, index) =>
        prisma.promoterRouteStop.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );

    return { count: input.stopIds.length };
  });
