import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { findDirectoryStoreMatch } from "@/app/router/field-map/_resolve-directory-store";
import { canManageStores } from "@/app/router/field-map/_can-manage-stores";
import { forwardGeocode } from "@/lib/geocode/nominatim";
import { z } from "zod";

/**
 * Preview de dedup do cadastro: geocoda o endereço digitado e procura no
 * catálogo nacional (`DirectoryStore`) uma loja que já represente este ponto —
 * por CNPJ ou por nome + 250 m. Só LÊ; quem grava é o `store.create`.
 *
 * Serve pro banner "Essa loja já existe no Tradegram como «X»" — reduzindo os
 * cadastros duplicados com nomes diferentes no mesmo endereço.
 */
export const matchDirectoryStore = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string().trim().min(2),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      /** CNPJ do estabelecimento (com ou sem máscara) — reforça o casamento. */
      document: z.string().optional(),
    }),
  )
  .output(
    z.object({
      geocoded: z.boolean(),
      latitude: z.number().nullable(),
      longitude: z.number().nullable(),
      match: z
        .object({
          directoryStoreId: z.string(),
          name: z.string(),
          address: z.string().nullable(),
          city: z.string().nullable(),
          state: z.string().nullable(),
          distanceM: z.number().nullable(),
        })
        .nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!(await canManageStores(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({ message: "Sem permissão" });
    }

    // Geocode best-effort: sem provedor de pé, ainda dá pra casar por CNPJ.
    const point = await forwardGeocode({
      street: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
    }).catch(() => null);

    const match = await findDirectoryStoreMatch({
      name: input.name,
      document: input.document ?? null,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      source: "USUARIO",
      sourceOrgId: context.org.id,
    });

    return {
      geocoded: !!point,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
      match: match
        ? {
            directoryStoreId: match.id,
            name: match.name,
            address: match.address,
            city: match.city,
            state: match.state,
            distanceM: match.distanceM,
          }
        : null,
    };
  });
