import {
  lerConversao,
  lerMarketing,
  siteConversaoSchema,
  siteMarketingSchema,
} from "@nerp/site-content";
import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireSiteAdminMiddleware } from "@/app/middlewares/site-admin";
import {
  montarPainelDeMarketing,
  painelDeMarketingSchema,
} from "@/features/site/server/painel-de-marketing";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";

const siteAdmin = base
  .use(requireAuthMiddleware)
  .use(requireSiteAdminMiddleware);

/** A chave em `site_settings` onde moram os pixels e tags de anúncio. */
export const MARKETING_KEY = "marketing";

/** A chave do aviso de saída, da barra fixa e do Astro que abre sozinho. */
export const CONVERSAO_KEY = "conversao";

export const painelDeMarketing = siteAdmin
  .input(z.object({ dias: z.number().int().min(1).max(365).default(30) }))
  .output(painelDeMarketingSchema)
  .handler(({ input }) => montarPainelDeMarketing(input.dias));

export const getMarketing = siteAdmin
  .input(z.object({}))
  .output(z.object({ marketing: siteMarketingSchema }))
  .handler(async () => {
    const row = await prisma.siteSetting.findUnique({
      where: { key: MARKETING_KEY },
    });
    return { marketing: lerMarketing(row?.value) };
  });

export const saveMarketing = siteAdmin
  .input(z.object({ marketing: siteMarketingSchema }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    // Pixel é código de terceiro rodando em todo visitante: decisão de quem
    // cuida da estrutura, não de quem escreve texto.
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não altera os pixels" });
    }
    const value = input.marketing as unknown as Prisma.InputJsonValue;
    await prisma.siteSetting.upsert({
      where: { key: MARKETING_KEY },
      create: { key: MARKETING_KEY, value },
      update: { value },
    });
    return { ok: true as const };
  });

export const getConversao = siteAdmin
  .input(z.object({}))
  .output(z.object({ conversao: siteConversaoSchema }))
  .handler(async () => {
    const row = await prisma.siteSetting.findUnique({
      where: { key: CONVERSAO_KEY },
    });
    return { conversao: lerConversao(row?.value) };
  });

export const saveConversao = siteAdmin
  .input(z.object({ conversao: siteConversaoSchema }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    // Popup em todas as páginas é decisão de estrutura, como os pixels.
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não altera a conversão" });
    }
    const value = input.conversao as unknown as Prisma.InputJsonValue;
    await prisma.siteSetting.upsert({
      where: { key: CONVERSAO_KEY },
      create: { key: CONVERSAO_KEY, value },
      update: { value },
    });
    return { ok: true as const };
  });
