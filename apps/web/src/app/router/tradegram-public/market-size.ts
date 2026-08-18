import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";

/**
 * Tamanho do mercado: quantos pontos de venda já estão mapeados.
 *
 * Lê **`DirectoryStore` e nada mais.** No dia em que alguém somar
 * `prisma.store.count()` "pra melhorar o número", este endpoint SEM
 * AUTENTICAÇÃO vira um oráculo de quantos clientes a plataforma tem e de
 * quantas lojas cada praça tem contratadas. As duas camadas nunca se misturam
 * num agregado público.
 *
 * `DirectoryStore` é derivado do OpenStreetMap e de listas de PDV, e já é
 * público via `getPublicMapPoints` — contar não expõe nada novo.
 */
export const getMarketSize = base
  .route({
    method: "GET",
    summary: "Tamanho do mercado mapeado (TradeGram)",
    tags: ["tradegram-public"],
  })
  .input(
    z.object({
      state: z.string().trim().max(40).optional(),
      city: z.string().trim().max(120).optional(),
    }),
  )
  .output(
    z.object({
      /** Todos os PDVs do catálogo, com ou sem pino no mapa. */
      total: z.number(),
      /** Quantos já têm posição — o que de fato aparece no mapa. */
      mapped: z.number(),
      inState: z.object({ state: z.string(), pdvs: z.number() }).nullable(),
      inCity: z
        .object({
          city: z.string(),
          state: z.string().nullable(),
          pdvs: z.number(),
        })
        .nullable(),
      topStates: z.array(z.object({ state: z.string(), pdvs: z.number() })),
    }),
  )
  .handler(async ({ input }) => {
    const [total, mapped, byState] = await Promise.all([
      prisma.directoryStore.count(),
      prisma.directoryStore.count({
        where: { latitude: { not: null }, longitude: { not: null } },
      }),
      // Bate no índice `@@index([state, city])` que já existe.
      prisma.directoryStore.groupBy({
        by: ["state"],
        _count: { _all: true },
        where: { state: { not: null } },
      }),
    ]);

    const states = byState
      .flatMap((row) =>
        row.state ? [{ state: row.state, pdvs: row._count._all }] : [],
      )
      .sort((a, b) => b.pdvs - a.pdvs);

    // Comparação frouxa: a UF pode estar gravada como "PI" ou "Piauí" conforme
    // a origem (OpenStreetMap escreve por extenso, planilha costuma abreviar).
    const wanted = input.state?.trim().toLowerCase();
    const inState =
      wanted !== undefined && wanted.length > 0
        ? (states.find(
            (row) =>
              row.state.toLowerCase() === wanted ||
              row.state.toLowerCase().startsWith(wanted),
          ) ?? { state: input.state ?? "", pdvs: 0 })
        : null;

    let inCity: { city: string; state: string | null; pdvs: number } | null =
      null;
    if (input.city?.trim()) {
      const pdvs = await prisma.directoryStore.count({
        where: {
          city: { equals: input.city.trim(), mode: "insensitive" },
          ...(input.state
            ? { state: { contains: input.state.trim(), mode: "insensitive" } }
            : {}),
        },
      });
      inCity = { city: input.city.trim(), state: input.state ?? null, pdvs };
    }

    return { total, mapped, inState, inCity, topStates: states.slice(0, 5) };
  });
