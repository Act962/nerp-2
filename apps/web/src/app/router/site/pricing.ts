import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireSiteAdminMiddleware } from "@/app/middlewares/site-admin";
import {
  ASTRO_PRECOS_KEY,
  astroPricingSchema,
  estimarFaixa,
  lerTabelaDePrecos,
} from "@/features/astro-consultor/server/preco";
import {
  ASTRO_CONFIG_KEY,
  astroConfigSchema,
  lerConfig,
} from "@/features/astro-consultor/server/provider";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";

/**
 * A tabela de faixas do Astro e o interruptor dele.
 *
 * Duas chaves separadas em `SiteSetting`, e nenhuma delas é a `site`: salvar
 * preço não pode sobrescrever contato e estatísticas, e desligar o consultor
 * não pode depender de mexer na tabela de preços.
 */

const siteAdmin = base
  .use(requireAuthMiddleware)
  .use(requireSiteAdminMiddleware);

export const getPricing = siteAdmin
  .input(z.object({}))
  .output(z.object({ pricing: astroPricingSchema, config: astroConfigSchema }))
  .handler(async () => {
    const [precos, config] = await Promise.all([
      prisma.siteSetting.findUnique({ where: { key: ASTRO_PRECOS_KEY } }),
      prisma.siteSetting.findUnique({ where: { key: ASTRO_CONFIG_KEY } }),
    ]);
    return {
      pricing: lerTabelaDePrecos(precos?.value),
      config: lerConfig(config?.value),
    };
  });

export const savePricing = siteAdmin
  .input(z.object({ pricing: astroPricingSchema }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não altera as faixas" });
    }
    const value = input.pricing as unknown as Prisma.InputJsonValue;
    await prisma.siteSetting.upsert({
      where: { key: ASTRO_PRECOS_KEY },
      create: { key: ASTRO_PRECOS_KEY, value },
      update: { value },
    });
    return { ok: true as const };
  });

export const saveAstroConfig = siteAdmin
  .input(z.object({ config: astroConfigSchema }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não altera o consultor" });
    }
    const value = input.config as unknown as Prisma.InputJsonValue;
    await prisma.siteSetting.upsert({
      where: { key: ASTRO_CONFIG_KEY },
      create: { key: ASTRO_CONFIG_KEY, value },
      update: { value },
    });
    return { ok: true as const };
  });

/**
 * Simula uma operação contra a tabela que está sendo editada — antes de salvar
 * e antes de ligar. É a mesma função que o consultor usa, então o que aparece
 * aqui é exatamente o que o cliente ouviria.
 */
export const simularPreco = siteAdmin
  .input(
    z.object({
      pricing: astroPricingSchema,
      lojas: z.number().int().min(0).max(10_000).default(1),
      usuarios: z.number().int().min(0).max(100_000).default(1),
      toolIds: z.array(z.string()).max(28).default([]),
    }),
  )
  .output(
    z.object({
      disponivel: z.boolean(),
      faixa: z.string().nullable(),
      porte: z.string().nullable(),
      setup: z.string().nullable(),
      memoria: z.array(z.string()),
      motivo: z.string().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const estimativa = estimarFaixa(input.pricing, {
      lojas: input.lojas,
      usuarios: input.usuarios,
      toolIds: input.toolIds,
    });
    if (!estimativa.disponivel) {
      return {
        disponivel: false,
        faixa: null,
        porte: null,
        setup: null,
        memoria: [],
        motivo: estimativa.motivo,
      };
    }
    return {
      disponivel: true,
      faixa: estimativa.faixa,
      porte: estimativa.porte,
      setup: estimativa.setup,
      memoria: estimativa.memoria,
      motivo: null,
    };
  });
