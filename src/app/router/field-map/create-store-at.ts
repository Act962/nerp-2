import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { reverseGeocode } from "@/lib/geocode/nominatim";
import { isInBrazil } from "@/lib/brazil-bounds";
import { hasFullAccess, memberCan } from "@/lib/permissions";
import { mintStoreSlug } from "@/lib/store-slug";
import { resolveDirectoryStore } from "./_resolve-directory-store";
import { z } from "zod";

/**
 * Cria um cliente marcando o ponto no mapa.
 *
 * A posição entra como `MANUAL`: foi uma pessoa apontando o dedo onde a loja
 * está, o que vale mais que qualquer estimativa — e por isso nenhuma rodada
 * automática vai sobrescrever depois.
 *
 * O endereço é resolvido pelo ponto (reverse-geocode), então quem cadastra não
 * precisa digitar rua nem bairro.
 */
export const createStoreAtPoint = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string().trim().min(2, "Informe o nome do supermercado").max(140),
      latitude: z.number(),
      longitude: z.number(),
      /** Chave R2 da foto/logo, já enviada pelo cliente. */
      coverImageKey: z.string().trim().min(1).nullable().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true, permissions: true },
    });

    // Criar cliente é gestão de cadastro — a mesma permissão da página de Lojas.
    if (
      !member ||
      (!hasFullAccess(member.role) && !memberCan(member, "lojas"))
    ) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para cadastrar clientes",
      });
    }

    if (!isInBrazil(input.latitude, input.longitude)) {
      throw errors.BAD_REQUEST({
        message: "O ponto escolhido está fora do Brasil",
      });
    }

    // Best-effort: o cadastro não pode depender do provedor estar de pé.
    const place = await reverseGeocode(input.latitude, input.longitude);
    const street =
      place.road && place.houseNumber
        ? `${place.road}, ${place.houseNumber}`
        : place.road;

    const store = await prisma.store.create({
      data: {
        organizationId: context.org.id,
        name: input.name,
        address: street ?? null,
        city: place.city ?? null,
        state: place.state ?? null,
        coverImageKey: input.coverImageKey ?? null,
        latitude: input.latitude,
        longitude: input.longitude,
        geoSource: "MANUAL",
        geoStatus: "OK",
        geoPrecision: "manual",
        geoUpdatedAt: new Date(),
      },
      select: { id: true },
    });

    await mintStoreSlug(store.id, input.name, place.city);

    // Toda loja nasce ligada ao ponto do catálogo nacional — é o que impede
    // duas organizações com o mesmo supermercado virarem dois pinos.
    const resolved = await resolveDirectoryStore({
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      address: street ?? null,
      suburb: place.suburb,
      city: place.city,
      state: place.state,
      source: "USUARIO",
      sourceOrgId: context.org.id,
    });
    if (resolved) {
      await prisma.store.update({
        where: { id: store.id },
        data: { directoryStoreId: resolved.id },
      });
    }

    return { id: store.id };
  });
