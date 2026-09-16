import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireSiteAdminMiddleware } from "@/app/middlewares/site-admin";
import { JORNADAS } from "@/features/jornadas/catalogo";
import { minutosDaJornada } from "@/features/jornadas/lib/tempo";
import {
  configDaJornada,
  JORNADAS_CONFIG_KEY,
  lerConfigDasJornadas,
  MAXIMO_DE_ESTRELAS,
} from "@/features/jornadas/server/config";
import { numerosDasJornadas } from "@/features/site/server/painel-das-jornadas";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";

/**
 * Quanto vale cada jornada, e como elas estão indo.
 *
 * A configuração mora na chave `jornadas` de `SiteSetting` — separada da
 * `site` e da tabela de faixas do Astro, porque mexer no preço de uma jornada
 * não pode sobrescrever contato do site nem preço de conversa.
 */

const siteAdmin = base
  .use(requireAuthMiddleware)
  .use(requireSiteAdminMiddleware);

export const getJornadas = siteAdmin
  .input(z.object({}))
  .output(
    z.object({
      recompensarSandbox: z.boolean(),
      jornadas: z.array(
        z.object({
          id: z.string(),
          modulo: z.string(),
          titulo: z.string(),
          rota: z.string(),
          totalPassos: z.number(),
          minutos: z.number(),
          starsSugeridas: z.number(),
          stars: z.number(),
          ativa: z.boolean(),
          concluintes: z.number(),
          emAndamento: z.number(),
          empresasRecompensadas: z.number(),
          starsPagas: z.number(),
          apressosMedio: z.number(),
        }),
      ),
    }),
  )
  .handler(async () => {
    const [ajustes, numeros] = await Promise.all([
      prisma.siteSetting.findUnique({ where: { key: JORNADAS_CONFIG_KEY } }),
      numerosDasJornadas(),
    ]);
    const config = lerConfigDasJornadas(ajustes?.value);

    return {
      recompensarSandbox: config.recompensarSandbox,
      jornadas: JORNADAS.map((jornada) => {
        const { stars, ativa } = configDaJornada(config, jornada);
        const n = numeros.get(jornada.id);
        return {
          id: jornada.id,
          modulo: jornada.modulo,
          titulo: jornada.titulo,
          rota: jornada.rota,
          totalPassos: jornada.passos.length,
          minutos: minutosDaJornada(jornada),
          starsSugeridas: jornada.starsSugeridas,
          stars,
          ativa,
          concluintes: n?.concluintes ?? 0,
          emAndamento: n?.emAndamento ?? 0,
          empresasRecompensadas: n?.empresasRecompensadas ?? 0,
          starsPagas: n?.starsPagas ?? 0,
          apressosMedio: n?.apressosMedio ?? 0,
        };
      }),
    };
  });

export const saveJornada = siteAdmin
  .input(
    z.object({
      jornadaId: z.string().min(1).optional(),
      stars: z.number().min(0).max(MAXIMO_DE_ESTRELAS).optional(),
      ativa: z.boolean().optional(),
      recompensarSandbox: z.boolean().optional(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({ message: "Redator não altera as jornadas" });
    }

    const atual = await prisma.siteSetting.findUnique({
      where: { key: JORNADAS_CONFIG_KEY },
    });
    const config = lerConfigDasJornadas(atual?.value);

    if (input.jornadaId) {
      const jornada = JORNADAS.find((j) => j.id === input.jornadaId);
      if (!jornada) {
        throw errors.NOT_FOUND({ message: "Jornada não encontrada" });
      }
      const anterior = configDaJornada(config, jornada);
      config.porJornada[jornada.id] = {
        stars: input.stars ?? anterior.stars,
        ativa: input.ativa ?? anterior.ativa,
      };
    }

    if (input.recompensarSandbox !== undefined) {
      config.recompensarSandbox = input.recompensarSandbox;
    }

    const value = config as unknown as Prisma.InputJsonValue;
    await prisma.siteSetting.upsert({
      where: { key: JORNADAS_CONFIG_KEY },
      create: { key: JORNADAS_CONFIG_KEY, value },
      update: { value },
    });

    return { ok: true as const };
  });
