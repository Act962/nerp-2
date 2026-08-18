import { base } from "@/app/middlewares/base";
import {
  CatalogOperationMode,
  CatalogSortOrder,
  DeliveryMethod,
  FreightChargeType,
  FreightOption,
  PaymentMethod,
} from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import z from "zod";

export const publicSettingsCatalog = base
  .route({
    method: "GET",
    summary: "Listar configurações de catálogo",
    tags: ["settings-catalog-public"],
  })
  .input(
    z.object({
      subdomain: z.string(),
    }),
  )
  .output(
    z.object({
      catalogSettings: z.object({
        id: z.string(),
        isActive: z.boolean(),
        showPrices: z.boolean(),
        showStock: z.boolean(),
        sortOrder: z.enum(CatalogSortOrder),
        allowOrders: z.boolean(),
        whatsappNumber: z.string().nullable(),
        showWhatsapp: z.boolean(),
        contactEmail: z.string().nullable(),
        metaTitle: z.string().nullable(),
        metaDescription: z.string().nullable(),
        logo: z.string().nullable(),
        bannerImages: z.array(z.string()).nullable(),
        aboutText: z.string().nullable(),
        theme: z.string().nullable(),
        instagram: z.string().nullable(),
        facebook: z.string().nullable(),
        twitter: z.string().nullable(),
        tiktok: z.string().nullable(),
        youtube: z.string().nullable(),
        kwai: z.string().nullable(),
        cep: z.string().nullable(),
        address: z.string().nullable(),
        district: z.string().nullable(),
        number: z.string().nullable(),
        id_meta: z.string().nullable(),
        pixel_meta: z.string().nullable(),
        showProductWithoutStock: z.boolean(),
        paymentMethodSettings: z.enum(PaymentMethod).array(),
        deliveryMethods: z.enum(DeliveryMethod).array(),
        freightOptions: z.enum(FreightOption),
        freightChargeType: z.enum(FreightChargeType),
        freightFixedValue: z.number(),
        freightValuePerKg: z.number(),
        freeShippingMinValue: z.number(),
        freeShippingEnabled: z.boolean(),
        deliverySpecialInfo: z.string().nullable(),
        cnpj: z.string().nullable(),
        operationMode: z.enum(CatalogOperationMode),
      }),
    }),
  )
  .handler(async ({ input, errors }) => {
    const { subdomain } = input;

    const organization = await prisma.organization.findUnique({
      where: { subdomain },
    });

    if (!organization) {
      throw errors.NOT_FOUND({ message: "Organização não encontrada" });
    }

    const catalogSettings = await prisma.catalogSettings.findUnique({
      where: { organizationId: organization.id },
    });

    if (!catalogSettings) {
      throw errors.NOT_FOUND({
        message: "Configurações de catálogo não encontradas",
      });
    }

    return {
      catalogSettings: {
        ...catalogSettings,
        freightFixedValue: Number(catalogSettings.freightFixedValue),
        freightValuePerKg: Number(catalogSettings.freightValuePerKg),
        freeShippingMinValue: Number(catalogSettings.freeShippingMinValue),
      },
    };
  });
