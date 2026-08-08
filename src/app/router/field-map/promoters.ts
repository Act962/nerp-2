import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { resolveFieldActor, resolveVisiblePromoters } from "./_access";

// Promotores do seletor. Para quem não é liderança volta só ele mesmo, então a
// tela nem precisa esconder o filtro — ele simplesmente não tem opção.
export const listMapPromoters = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .output(
    z.object({
      canSeeAll: z.boolean(),
      promoters: z.array(
        z.object({
          memberId: z.string(),
          name: z.string(),
          lastGeoState: z.string().nullable(),
          lastGeoStateAt: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ context, errors }) => {
    const actor = await resolveFieldActor(context.org.id, context.user.id);
    if (!actor) {
      throw errors.FORBIDDEN({
        message: "Você não é membro desta organização",
      });
    }

    const promoters = await resolveVisiblePromoters({
      organizationId: context.org.id,
      actor,
    });

    return {
      canSeeAll: actor.canSeeAll,
      promoters: promoters.map((promoter) => ({
        memberId: promoter.memberId,
        name: promoter.name,
        lastGeoState: promoter.lastGeoState,
        lastGeoStateAt: promoter.lastGeoStateAt,
      })),
    };
  });
