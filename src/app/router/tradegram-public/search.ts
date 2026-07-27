import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";

// Busca cross-org do TradeGram: procura grupos (orgs), lojas e indústrias em
// TODAS as organizações com perfil público. Sem auth — só enxerga o que é
// público (isPublicProfile), nunca dado de org privada.
export const searchPublic = base
  .route({
    method: "GET",
    summary: "Busca TradeGram (pública)",
    tags: ["tradegram-public"],
  })
  .input(
    z.object({
      q: z.string().trim().min(1),
      limit: z.number().int().min(1).max(20).default(8),
    }),
  )
  .handler(async ({ input }) => {
    const term = input.q;
    const take = input.limit;

    const [groups, stores, suppliers, companies] = await Promise.all([
      prisma.organization.findMany({
        where: {
          isPublicProfile: true,
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { slug: { contains: term, mode: "insensitive" } },
          ],
        },
        orderBy: { name: "asc" },
        take,
        select: { slug: true, name: true, logo: true },
      }),
      prisma.store.findMany({
        where: {
          isActive: true,
          organization: { isPublicProfile: true },
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { city: { contains: term, mode: "insensitive" } },
          ],
        },
        orderBy: { name: "asc" },
        take,
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          coverImageKey: true,
          organization: { select: { slug: true } },
        },
      }),
      prisma.supplier.findMany({
        where: {
          organization: { isPublicProfile: true },
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { tradeName: { contains: term, mode: "insensitive" } },
          ],
        },
        orderBy: { name: "asc" },
        take,
        select: {
          id: true,
          name: true,
          logo: true,
          organization: { select: { slug: true } },
        },
      }),
      // Diretório: cascas ainda não reivindicadas — dão lastro à base pública
      // (aparecem na busca desde o dia 1, mesmo sem org por trás).
      prisma.directoryCompany.findMany({
        where: {
          claimedByOrgId: null,
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { tradeName: { contains: term, mode: "insensitive" } },
            { city: { contains: term, mode: "insensitive" } },
          ],
        },
        orderBy: { name: "asc" },
        take,
        select: {
          id: true,
          type: true,
          name: true,
          city: true,
          state: true,
          logoKey: true,
        },
      }),
    ]);

    return {
      groups: groups.map((group) => ({
        type: "group" as const,
        slug: group.slug,
        name: group.name,
        logoKey: group.logo,
      })),
      stores: stores.map((store) => ({
        type: "store" as const,
        storeId: store.id,
        orgSlug: store.organization.slug,
        name: store.name,
        city: store.city,
        state: store.state,
        coverImageKey: store.coverImageKey,
      })),
      suppliers: suppliers.map((supplier) => ({
        type: "supplier" as const,
        supplierId: supplier.id,
        orgSlug: supplier.organization.slug,
        name: supplier.name,
        logoKey: supplier.logo,
      })),
      companies: companies.map((company) => ({
        type: "company" as const,
        companyId: company.id,
        companyType: company.type,
        name: company.name,
        city: company.city,
        state: company.state,
        logoKey: company.logoKey,
      })),
    };
  });
