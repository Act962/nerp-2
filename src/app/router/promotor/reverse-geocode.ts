import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
};

// Reverse-geocode server-side (evita CORS do browser). Best-effort: qualquer
// falha vira { null, null } — a geolocalização nunca bloqueia a captura.
// Nominatim exige User-Agent real e pede ~1 req/s; como é por captura (ritmo
// humano) está ok. Escala futura: provider com chave (Google/Mapbox) ou
// instância própria do Nominatim.
export const reverseGeocode = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ latitude: z.number(), longitude: z.number() }))
  .output(
    z.object({
      city: z.string().nullable(),
      state: z.string().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("format", "json");
      url.searchParams.set("lat", String(input.latitude));
      url.searchParams.set("lon", String(input.longitude));
      url.searchParams.set("zoom", "10");
      url.searchParams.set("addressdetails", "1");

      const response = await fetch(url, {
        headers: { "User-Agent": "nerp-2/1.0 (trade-promotor)" },
        signal: controller.signal,
      });
      if (!response.ok) return { city: null, state: null };

      const data = (await response.json()) as { address?: NominatimAddress };
      const address = data.address ?? {};
      const city =
        address.city ??
        address.town ??
        address.village ??
        address.municipality ??
        null;
      return { city, state: address.state ?? null };
    } catch {
      return { city: null, state: null };
    } finally {
      clearTimeout(timeout);
    }
  });
