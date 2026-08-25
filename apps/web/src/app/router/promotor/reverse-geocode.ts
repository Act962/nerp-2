import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { reverseGeocode as lookup } from "@/lib/geocode/nominatim";
import { z } from "zod";

// Reverse-geocode server-side (evita CORS do browser). Best-effort: qualquer
// falha vira campos nulos — a geolocalização nunca bloqueia a captura.
//
// A chamada vive em `@/lib/geocode/nominatim`, junto com o forward-geocode das
// lojas: é o mesmo provedor e a mesma cota, e separar seria pedir para um dos
// dois estourar o limite e derrubar o outro.
export const reverseGeocode = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ latitude: z.number(), longitude: z.number() }))
  .output(
    z.object({
      city: z.string().nullable(),
      state: z.string().nullable(),
      road: z.string().nullable(),
      houseNumber: z.string().nullable(),
      suburb: z.string().nullable(),
      postcode: z.string().nullable(),
      label: z.string().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    return lookup(input.latitude, input.longitude);
  });
