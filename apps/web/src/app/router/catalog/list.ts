import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

export const listSettingsCatalog = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar configurações de catálogo",
    tags: ["settings-catalog"],
  })

  .handler(async ({ context }) => {
    const catalogSettings = await prisma.catalogSettings.upsert({
      where: {
        organizationId: context.org.id,
      },
      create: {
        organizationId: context.org.id,
      },
      update: {},
    });

    return {
      catalogSettings: {
        ...catalogSettings,

        freightFixedValue: Number(catalogSettings.freightFixedValue),
        freightValuePerKg: Number(catalogSettings.freightValuePerKg),
        freeShippingMinValue: Number(catalogSettings.freeShippingMinValue),
      },
    };
  });
