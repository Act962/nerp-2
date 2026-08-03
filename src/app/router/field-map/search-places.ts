import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { searchPlaces } from "@/lib/geocode/nominatim";
import { z } from "zod";

/**
 * Busca por nome no mapa inteiro, não na carteira.
 *
 * O usuário procura uma empresa que ainda NÃO é cliente — filtrar a lista de
 * lojas cadastradas responderia a pergunta errada. Aqui quem responde é o
 * OpenStreetMap, e o resultado é um lugar para onde ir, não um registro.
 */
export const searchMapPlaces = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ query: z.string().trim().min(3).max(120) }))
  .output(
    z.object({
      places: z.array(
        z.object({
          osmId: z.string().nullable(),
          name: z.string(),
          label: z.string(),
          latitude: z.number(),
          longitude: z.number(),
          category: z.string().nullable(),
          isSupermarket: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async ({ input }) => {
    return { places: await searchPlaces(input.query) };
  });
