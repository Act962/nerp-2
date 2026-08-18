import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  DEFAULT_FLOW_MULTIPLIERS,
  DEFAULT_TIER_MULTIPLIERS,
  DEFAULT_VISIBILITY_MULTIPLIERS,
} from "@/features/trade-catalog/lib/pricing";
import prisma from "@/lib/db";
import { z } from "zod";

const multipliersSchema = z.record(z.string(), z.number().positive());

export const updateTradePricingSettings = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      markup: z.number().positive().optional(),
      floorPrice: z.number().nonnegative().nullable().optional(),
      tierMultipliers: multipliersSchema.optional(),
      flowMultipliers: multipliersSchema.optional(),
      visibilityMultipliers: multipliersSchema.optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const settings = await prisma.tradePricingSettings.upsert({
      where: { organizationId: context.org.id },
      create: {
        organizationId: context.org.id,
        markup: input.markup,
        floorPrice: input.floorPrice,
        tierMultipliers: input.tierMultipliers ?? DEFAULT_TIER_MULTIPLIERS,
        flowMultipliers: input.flowMultipliers ?? DEFAULT_FLOW_MULTIPLIERS,
        visibilityMultipliers:
          input.visibilityMultipliers ?? DEFAULT_VISIBILITY_MULTIPLIERS,
      },
      update: {
        markup: input.markup,
        floorPrice: input.floorPrice,
        tierMultipliers: input.tierMultipliers,
        flowMultipliers: input.flowMultipliers,
        visibilityMultipliers: input.visibilityMultipliers,
      },
    });

    return {
      id: settings.id,
      markup: settings.markup,
      floorPrice: settings.floorPrice ? Number(settings.floorPrice) : null,
    };
  });
