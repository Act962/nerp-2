import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type {
  SpaceFlowLevel,
  SpaceTier,
  SpaceVisibility,
} from "@/generated/prisma/enums";
import {
  computeSuggestedPrice,
  DEFAULT_FLOW_MULTIPLIERS,
  DEFAULT_TIER_MULTIPLIERS,
  DEFAULT_VISIBILITY_MULTIPLIERS,
  resolveDisplayPrice,
} from "@/features/trade-catalog/lib/pricing";
import prisma from "@/lib/db";
import { z } from "zod";

// Lista de preços do Catálogo PDV pra uma loja: cada mídia ativa da org com o
// preço resolvido (manual da loja > padrão da org > sugestão calculada). Não
// usa geometria de nenhum objeto específico (é o catálogo genérico, não a
// cotação de um espaço já desenhado) — a sugestão vem de notionalAreaM2.
export const listCatalogPdv = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ storeId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const store = await prisma.store.findFirst({
      where: { id: input.storeId, organizationId: context.org.id },
      select: { id: true, areaM2: true, monthlyCost: true },
    });
    if (!store) throw errors.NOT_FOUND({ message: "Loja não encontrada" });

    const [mediaTypes, manualPrices, settings] = await Promise.all([
      prisma.mediaType.findMany({
        where: { organizationId: context.org.id, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.mediaTypePrice.findMany({
        where: { storeId: input.storeId, organizationId: context.org.id },
      }),
      prisma.tradePricingSettings.findUnique({
        where: { organizationId: context.org.id },
      }),
    ]);

    const manualByMediaTypeId = new Map(
      manualPrices.map((price) => [price.mediaTypeId, price]),
    );

    const pricingSettings = {
      markup: settings?.markup ?? 3,
      floorPrice: settings?.floorPrice ? Number(settings.floorPrice) : null,
      tierMultipliers:
        (settings?.tierMultipliers as Record<SpaceTier, number> | undefined) ??
        DEFAULT_TIER_MULTIPLIERS,
      flowMultipliers:
        (settings?.flowMultipliers as
          | Record<SpaceFlowLevel, number>
          | undefined) ?? DEFAULT_FLOW_MULTIPLIERS,
      visibilityMultipliers:
        (settings?.visibilityMultipliers as
          | Record<SpaceVisibility, number>
          | undefined) ?? DEFAULT_VISIBILITY_MULTIPLIERS,
    };

    const storeCost = {
      areaM2: store.areaM2,
      monthlyCost: store.monthlyCost ? Number(store.monthlyCost) : null,
    };

    const items = mediaTypes.map((mediaType) => {
      const manual = manualByMediaTypeId.get(mediaType.id);
      const suggested = computeSuggestedPrice(
        storeCost,
        {
          pricingBasis: mediaType.pricingBasis,
          notionalAreaM2: mediaType.notionalAreaM2,
        },
        { tier: null, flowLevel: null, visibility: null },
        null,
        pricingSettings,
      );
      const resolved = resolveDisplayPrice(
        manual ? Number(manual.price) : null,
        mediaType.basePrice ? Number(mediaType.basePrice) : null,
        suggested,
      );

      return {
        mediaTypeId: mediaType.id,
        code: mediaType.code,
        name: mediaType.name,
        kind: mediaType.kind,
        pricingBasis: mediaType.pricingBasis,
        price: resolved.value,
        priceSource: resolved.source,
        manualPriceId: manual?.id ?? null,
      };
    });

    return {
      items,
      missingStoreCostData: !storeCost.areaM2 || !storeCost.monthlyCost,
    };
  });
