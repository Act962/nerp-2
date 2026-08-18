import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "../_access";
import { ALL_PERIOD_TYPES, periodTypeSchema } from "../_schemas";

const prizeSchema = z.object({
  position: z.number().int().min(1).max(4),
  label: z.string().min(1),
  // Chave S3 (mesmo padrão de photoUrl das entries) ou URL completa; a URL
  // final é construída no client. Por isso não força .url() aqui.
  imageUrl: z.string().optional(),
});

const updateSalesGoalRankingSettingsInputSchema = z.object({
  displayName: z.string().min(1).optional(),
  theme: z.enum(["GAMING", "LIGHT", "DARK", "GALAXY"]).optional(),
  activePeriodTypes: z.array(periodTypeSchema).min(1).optional(),
  soundEnabled: z.boolean().optional(),
  // Aceita URL completa (link colado pelo admin) OU o id de um preset
  // sintetizado (ex: "score-ding") — ver sales-goal-sound-presets.ts.
  scoreSoundUrl: z.string().min(1).nullable().optional(),
  overtakeSoundUrl: z.string().min(1).nullable().optional(),
  victorySoundUrl: z.string().min(1).nullable().optional(),
  soundVolume: z.number().min(0).max(1).optional(),
  prizes: z.array(prizeSchema).max(4).optional(),
});

export const updateSalesGoalRankingSettings = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Atualizar configurações do ranking",
    tags: ["ranking"],
  })
  .input(updateSalesGoalRankingSettingsInputSchema)
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const settings = await prisma.salesGoalRankingSettings.upsert({
      where: { organizationId: context.org.id },
      create: {
        organizationId: context.org.id,
        displayName: input.displayName,
        theme: input.theme,
        activePeriodTypes: input.activePeriodTypes ?? [...ALL_PERIOD_TYPES],
        soundEnabled: input.soundEnabled,
        scoreSoundUrl: input.scoreSoundUrl,
        overtakeSoundUrl: input.overtakeSoundUrl,
        victorySoundUrl: input.victorySoundUrl,
        soundVolume: input.soundVolume,
        prizes: input.prizes,
      },
      update: {
        displayName: input.displayName,
        theme: input.theme,
        activePeriodTypes: input.activePeriodTypes,
        soundEnabled: input.soundEnabled,
        scoreSoundUrl: input.scoreSoundUrl,
        overtakeSoundUrl: input.overtakeSoundUrl,
        victorySoundUrl: input.victorySoundUrl,
        soundVolume: input.soundVolume,
        prizes: input.prizes,
      },
    });

    return {
      id: settings.id,
      displayName: settings.displayName,
      theme: settings.theme,
      activePeriodTypes: settings.activePeriodTypes,
      soundEnabled: settings.soundEnabled,
      scoreSoundUrl: settings.scoreSoundUrl,
      overtakeSoundUrl: settings.overtakeSoundUrl,
      victorySoundUrl: settings.victorySoundUrl,
      soundVolume: settings.soundVolume,
      prizes: settings.prizes as {
        position: number;
        label: string;
        imageUrl?: string;
      }[],
    };
  });
