import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
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

export const updateSettingsCatalog = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PUT",
    path: "/settings-catalog/:id",
    summary: "Atualizar configuração do catálogo",
    tags: ["settings-catalog"],
  })
  .input(
    z.object({
      id: z.string(),
      isActive: z.boolean().optional(),
      showPrices: z.boolean().optional(),
      showStock: z.boolean().optional(),
      sortOrder: z.enum(CatalogSortOrder).optional(),
      operationMode: z.enum(CatalogOperationMode).optional(),
      allowOrders: z.boolean().optional(),
      whatsappNumber: z.string().optional(),
      showWhatsapp: z.boolean().optional(),
      contactEmail: z.string().optional(),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      logo: z.string().optional(),
      bannerImages: z.string().array().optional(),
      aboutText: z.string().optional(),
      theme: z.string().optional(),
      backgroundColor: z.string().optional(),
      astroEnabled: z.boolean().optional(),
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      twitter: z.string().optional(),
      tiktok: z.string().optional(),
      youtube: z.string().optional(),
      kwai: z.string().optional(),
      cep: z.string().optional(),
      address: z.string().optional(),
      district: z.string().optional(),
      number: z.string().optional(),
      id_meta: z.string().optional(),
      pixel_meta: z.string().optional(),
      showProductWithoutStock: z.boolean().optional(),
      paymentMethodSettings: z.enum(PaymentMethod).array().optional(),
      deliveryMethods: z.enum(DeliveryMethod).array().optional(),
      freightOptions: z.enum(FreightOption).optional(),
      freightChargeType: z.enum(FreightChargeType).optional(),
      freightFixedValue: z.number().optional(),
      freightValuePerKg: z.number().optional(),
      freeShippingEnabled: z.boolean().optional(),
      freeShippingMinValue: z.number().optional(),
      cnpj: z.string().optional(),
      deliverySpecialInfo: z.string().optional(),
      walletId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // O `id` vem do cliente, então ele é reconferido contra a organização da
    // sessão: sem `organizationId` aqui, um id de outra loja atualizaria o
    // catálogo dela (multi-tenancy é manual neste app). A conferência fica
    // FORA do try — dentro dele, o `catch` transformaria o 404 em 500.
    const catalogSettings = await prisma.catalogSettings.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });

    if (!catalogSettings) {
      throw errors.NOT_FOUND({
        message: "Configuração do catálogo não encontrada.",
      });
    }

    const { id, ...rest } = input;

    try {
      await prisma.catalogSettings.update({
        where: { id, organizationId: context.org.id },
        data: { ...rest },
      });
    } catch (error) {
      console.log(error);
      throw errors.INTERNAL_SERVER_ERROR({});
    }
  });
