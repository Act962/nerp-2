import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  DEFAULT_FLOW_MULTIPLIERS,
  DEFAULT_PRICING_SETTINGS,
  DEFAULT_TIER_MULTIPLIERS,
  DEFAULT_VISIBILITY_MULTIPLIERS,
} from "@/features/trade-catalog/lib/pricing";
import prisma from "@/lib/db";
import { z } from "zod";

export const getTradePricingSettings = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const settings = await prisma.tradePricingSettings.findUnique({
      where: { organizationId: context.org.id },
    });

    if (!settings) {
      return {
        id: null,
        markup: DEFAULT_PRICING_SETTINGS.markup,
        floorPrice: null,
        tierMultipliers: DEFAULT_TIER_MULTIPLIERS,
        flowMultipliers: DEFAULT_FLOW_MULTIPLIERS,
        visibilityMultipliers: DEFAULT_VISIBILITY_MULTIPLIERS,
      };
    }

    return {
      id: settings.id,
      markup: settings.markup,
      floorPrice: settings.floorPrice ? Number(settings.floorPrice) : null,
      tierMultipliers: settings.tierMultipliers as Record<string, number>,
      flowMultipliers: settings.flowMultipliers as Record<string, number>,
      visibilityMultipliers: settings.visibilityMultipliers as Record<
        string,
        number
      >,
    };
  });
