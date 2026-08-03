import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { isInBrazil } from "@/lib/brazil-bounds";
import prisma from "@/lib/db";
import { boundsTooLarge, findSupermarkets } from "@/lib/geocode/overpass";
import { z } from "zod";
import { canManageStores } from "./_can-manage-stores";
import { resolveDirectoryStore } from "./_resolve-directory-store";

const boundsSchema = z.object({
  south: z.number().min(-90).max(90),
  west: z.number().min(-180).max(180),
  north: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
});

/**
 * Varre a área no OpenStreetMap e ALIMENTA o catálogo global.
 *
 * Não devolve pinos para a tela desenhar: grava o que achou em `DirectoryStore`
 * e deixa o mapa reler dali. A diferença não é de arrumação — um ponto efêmero
 * não tem onde guardar logo, não tem página pública e não pode entrar numa
 * rota. Persistindo, o supermercado achado em Caxias vira um "Ponto do
 * OpenStreetMap" de verdade, igual aos de Teresina, para toda organização.
 *
 * Idempotente pelo `osmId`: varrer a mesma área dez vezes não duplica nada.
 */
export const searchOsmStores = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(boundsSchema)
  .output(
    z.object({
      found: z.number(),
      added: z.number(),
      unnamed: z.number(),
      truncated: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!(await canManageStores(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para cadastrar clientes",
      });
    }

    if (input.south >= input.north || input.west >= input.east) {
      throw errors.BAD_REQUEST({ message: "Área do mapa inválida" });
    }

    // O catálogo é do Brasil. Varrer fora daqui encheria o mapa de todo mundo
    // com pontos que ninguém neste produto vai visitar.
    if (
      !isInBrazil(input.south, input.west) &&
      !isInBrazil(input.north, input.east)
    ) {
      throw errors.BAD_REQUEST({
        message:
          "O catálogo do TradeGram cobre o Brasil. Volte o mapa para cá.",
      });
    }

    if (boundsTooLarge(input)) {
      throw errors.BAD_REQUEST({
        message:
          "Área grande demais para buscar. Aproxime até enquadrar uma cidade e tente de novo.",
      });
    }

    const result = await findSupermarkets(input);
    if (!result) {
      // "Deu ruim ao perguntar" e "não há supermercado aqui" não podem chegar
      // iguais na tela — a primeira tem retentativa, a segunda não.
      throw errors.INTERNAL_SERVER_ERROR({
        message:
          "O OpenStreetMap não respondeu agora. Tente novamente em alguns segundos.",
      });
    }

    const inBrazil = result.stores.filter((store) =>
      isInBrazil(store.latitude, store.longitude),
    );

    // Checagem em LOTE antes de resolver um a um: numa área já varrida, quase
    // tudo cai aqui e a rodada custa uma consulta, não duas por ponto.
    const known = await prisma.directoryStore.findMany({
      where: { osmId: { in: inBrazil.map((store) => store.osmId) } },
      select: { osmId: true },
    });
    const seen = new Set(known.map((point) => point.osmId));

    // Os que sobram passam pela porta única, que ainda os casa por proximidade
    // e nome — é o que evita duplicar um ponto que o promotor já cadastrou
    // fotografando, e que portanto não tem `osmId`.
    let count = 0;
    for (const store of inBrazil) {
      if (seen.has(store.osmId)) continue;
      const resolved = await resolveDirectoryStore({
        ...store,
        source: "IMPORTACAO",
        sourceOrgId: context.org.id,
      });
      if (resolved?.created) count += 1;
    }

    return {
      found: result.stores.length,
      added: count,
      unnamed: result.unnamed,
      truncated: result.truncated,
    };
  });
