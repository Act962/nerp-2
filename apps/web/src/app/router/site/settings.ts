import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireSiteAdminMiddleware } from "@/app/middlewares/site-admin";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";

const siteAdmin = base
  .use(requireAuthMiddleware)
  .use(requireSiteAdminMiddleware);

/**
 * Os ajustes soltos do site. Ficam em chave/valor porque são poucos e mudam de
 * forma independente; o formato de cada chave é este schema.
 */
export const siteSettingsSchema = z.object({
  stats: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .default([]),
  contact: z
    .object({
      email: z.string().default(""),
      phone: z.string().default(""),
    })
    .default({ email: "", phone: "" }),
  whatsapp: z
    .object({
      number: z.string().default(""),
      label: z.string().default("Agendar Demonstração"),
    })
    .default({ number: "", label: "Agendar Demonstração" }),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

const SETTINGS_KEY = "site";

export const getSettings = siteAdmin
  .input(z.object({}))
  .output(z.object({ settings: siteSettingsSchema }))
  .handler(async () => {
    const row = await prisma.siteSetting.findUnique({
      where: { key: SETTINGS_KEY },
    });
    // Chave ausente ou fora de formato vira o padrão em vez de erro: o admin
    // tem de abrir mesmo com o banco vazio.
    const parsed = siteSettingsSchema.safeParse(row?.value ?? {});
    return {
      settings: parsed.success ? parsed.data : siteSettingsSchema.parse({}),
    };
  });

export const saveSettings = siteAdmin
  .input(z.object({ settings: siteSettingsSchema }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não altera os ajustes" });
    }
    const value = input.settings as unknown as Prisma.InputJsonValue;
    await prisma.siteSetting.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value },
      update: { value },
    });
    return { ok: true as const };
  });
