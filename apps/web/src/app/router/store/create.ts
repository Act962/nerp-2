import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { canManageStores } from "@/app/router/field-map/_can-manage-stores";
import { resolveDirectoryStore } from "@/app/router/field-map/_resolve-directory-store";
import prisma from "@/lib/db";
import { isInBrazil } from "@/lib/brazil-bounds";
import { mintStoreSlug } from "@/lib/store-slug";
import { z } from "zod";

export const createStore = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
      code: z.string().optional(),
      managerName: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      notes: z.string().optional(),
      coverImageKey: z.string().nullable().optional(),
      areaM2: z.number().positive().nullable().optional(),
      monthlyCost: z.number().nonnegative().nullable().optional(),
      customersPerDay: z.number().int().nonnegative().nullable().optional(),
      // Dedup: coords geocodadas do endereço + ponto do diretório escolhido pelo
      // usuário no banner "já existe no Tradegram". Opcionais — sem eles, cria
      // como antes.
      latitude: z.number().nullable().optional(),
      longitude: z.number().nullable().optional(),
      directoryStoreId: z.string().nullable().optional(),
      document: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string(), name: z.string() }))
  .handler(async ({ input, context, errors }) => {
    // PROMOTOR só enxerga (ver `lojas/list.ts`) — criar continua exigindo a
    // permissão de página de verdade, senão a leitura somente-leitura vira
    // escrita por quem chama o procedure direto.
    if (!(await canManageStores(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para cadastrar lojas",
      });
    }

    // Coords vindas do geocode do cadastro (via store.matchDirectory). Só valem
    // se forem no Brasil; entram como GEOCODED (nunca sobrescreve pino MANUAL/FOTO
    // — é loja nova).
    const hasGeo =
      input.latitude != null &&
      input.longitude != null &&
      isInBrazil(input.latitude, input.longitude);

    const store = await prisma.store.create({
      data: {
        organizationId: context.org.id,
        name: input.name,
        code: input.code,
        managerName: input.managerName,
        address: input.address,
        city: input.city,
        state: input.state,
        notes: input.notes,
        coverImageKey: input.coverImageKey,
        areaM2: input.areaM2,
        monthlyCost: input.monthlyCost,
        customersPerDay: input.customersPerDay,
        ...(hasGeo
          ? {
              latitude: input.latitude,
              longitude: input.longitude,
              geoSource: "GEOCODED" as const,
              geoStatus: "OK" as const,
              geoPrecision: "geocoded",
              geoUpdatedAt: new Date(),
            }
          : {}),
        directoryStoreId: input.directoryStoreId ?? null,
      },
    });

    await mintStoreSlug(store.id, store.name, store.city);

    // Loja nova nasce ligada ao ponto do catálogo nacional (evita dois pinos da
    // mesma loja em orgs diferentes). Se o usuário já escolheu um ponto no banner,
    // respeita; senão, resolve por CNPJ/localização. Best-effort — não derruba o
    // cadastro se o catálogo falhar.
    if (!input.directoryStoreId && (hasGeo || input.document)) {
      try {
        const resolved = await resolveDirectoryStore({
          name: input.name,
          document: input.document ?? null,
          latitude: hasGeo ? input.latitude : null,
          longitude: hasGeo ? input.longitude : null,
          address: input.address ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          source: "USUARIO",
          sourceOrgId: context.org.id,
        });
        if (resolved) {
          await prisma.store.update({
            where: { id: store.id },
            data: { directoryStoreId: resolved.id },
          });
        }
      } catch {
        // catálogo indisponível: a loja já está criada, segue.
      }
    }

    return { id: store.id, name: store.name };
  });
