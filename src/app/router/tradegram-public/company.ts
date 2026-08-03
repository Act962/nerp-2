import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";

/** Teto de pontos da rede — endpoint público sem rate limiting. */
const MAX_POINTS = 200;

/**
 * Perfil público de uma empresa do diretório.
 *
 * ALLOWLIST explícita, no espírito de `store-map.ts`. Três regras que são fáceis
 * de errar e caras de descobrir depois:
 *
 * 1. **Nunca devolver `document`.** Não é só privacidade: a reivindicação é
 *    verificada POR CNPJ, então imprimi-lo aqui derrotaria a evidência por
 *    copiar-e-colar.
 * 2. **`owner` só sai quando o dono é público.** Senão a página vira oráculo de
 *    quais empresas são clientes da plataforma — mesma disciplina de
 *    `_public-face.ts`.
 * 3. **`points` vem só de `DirectoryStore`.** Juntar `Store` para "enriquecer"
 *    exporia carteira.
 */
export const getPublicCompany = base
  .route({
    method: "GET",
    summary: "Empresa do diretório (pública)",
    tags: ["tradegram-public"],
  })
  .input(z.object({ companyId: z.string().min(1) }))
  .output(
    z.object({
      header: z.object({
        name: z.string(),
        tradeName: z.string().nullable(),
        type: z.enum(["SUPERMERCADO", "INDUSTRIA", "DISTRIBUIDOR"]),
        city: z.string().nullable(),
        state: z.string().nullable(),
        logoKey: z.string().nullable(),
        website: z.string().nullable(),
      }),
      owner: z.object({
        isClaimed: z.boolean(),
        orgSlug: z.string().nullable(),
        orgName: z.string().nullable(),
      }),
      network: z.object({
        pdvs: z.number(),
        mapped: z.number(),
        cities: z.number(),
        states: z.array(z.string()),
      }),
      points: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          latitude: z.number(),
          longitude: z.number(),
          city: z.string().nullable(),
          state: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, errors }) => {
    const company = await prisma.directoryCompany.findUnique({
      where: { id: input.companyId },
      select: {
        id: true,
        name: true,
        tradeName: true,
        type: true,
        city: true,
        state: true,
        logoKey: true,
        website: true,
        claimedByOrg: {
          select: { slug: true, name: true, isPublicProfile: true },
        },
      },
    });
    if (!company) {
      throw errors.NOT_FOUND({ message: "Empresa não encontrada" });
    }

    const stores = await prisma.directoryStore.findMany({
      where: { companyId: company.id },
      take: MAX_POINTS + 1,
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        city: true,
        state: true,
      },
    });

    const placed = stores.filter(
      (
        store,
      ): store is typeof store & { latitude: number; longitude: number } =>
        store.latitude !== null && store.longitude !== null,
    );

    const owner = company.claimedByOrg;
    const ownerIsPublic = Boolean(owner?.isPublicProfile && owner.slug);

    return {
      header: {
        name: company.name,
        tradeName: company.tradeName,
        type: company.type,
        city: company.city,
        state: company.state,
        logoKey: company.logoKey,
        website: company.website,
      },
      owner: {
        isClaimed: Boolean(owner),
        orgSlug: ownerIsPublic ? (owner?.slug ?? null) : null,
        orgName: ownerIsPublic ? (owner?.name ?? null) : null,
      },
      network: {
        pdvs: stores.length,
        mapped: placed.length,
        cities: new Set(stores.map((store) => store.city).filter(Boolean)).size,
        states: [
          ...new Set(
            stores.flatMap((store) => (store.state ? [store.state] : [])),
          ),
        ].slice(0, 10),
      },
      points: placed.slice(0, MAX_POINTS),
    };
  });
