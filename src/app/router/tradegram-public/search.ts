import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

// Busca cross-org do TradeGram: procura grupos (orgs), lojas e indústrias em
// TODAS as organizações com perfil público. Sem auth — só enxerga o que é
// público (isPublicProfile), nunca dado de org privada.
//
// Casamento tolerante a acento e caixa: o promotor digita "sao braz" e
// "acai" e casa "São Braz" e "Açaí". Preço: consultas com `$queryRaw` em
// vez do query builder (o Prisma não expõe `unaccent`). A extensão vem
// junto na migration `20260804160000_unaccent_extension`.

/** Prepara o termo para `unaccent(lower(...)) ILIKE unaccent(lower(?))`. */
function likeToken(term: string): string {
  const escaped = term.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escaped}%`;
}

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
    const like = likeToken(term);
    // `Prisma.sql` interpola `${take}` como parâmetro numérico seguro; sem isto
    // o Postgres reclamaria de tipo.
    const take = input.limit;

    // Ids sem acento — retornamos as chaves, e depois vamos ao Prisma
    // buscar os detalhes já com os `select` que precisamos. Duas idas ao
    // banco por entidade, sim, mas é a única forma de manter o `select`
    // familiar sem escrever manualmente o SELECT.
    const [groupIds, storeIds, supplierIds, companyIds, directoryStoreIds] =
      await Promise.all([
        prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM organization
        WHERE "isPublicProfile" = TRUE
          AND (
            unaccent(lower(name)) ILIKE unaccent(${like})
            OR unaccent(lower(slug)) ILIKE unaccent(${like})
          )
        ORDER BY name ASC
        LIMIT ${take}
      `,
        prisma.$queryRaw<{ id: string }[]>`
        SELECT s.id FROM stores s
        JOIN organization o ON o.id = s."organizationId"
        WHERE s."isActive" = TRUE
          AND o."isPublicProfile" = TRUE
          AND (
            unaccent(lower(s.name)) ILIKE unaccent(${like})
            OR unaccent(lower(coalesce(s.city, ''))) ILIKE unaccent(${like})
          )
        ORDER BY s.name ASC
        LIMIT ${take}
      `,
        prisma.$queryRaw<{ id: string }[]>`
        SELECT sup.id FROM suppliers sup
        JOIN organization o ON o.id = sup."organizationId"
        WHERE o."isPublicProfile" = TRUE
          AND (
            unaccent(lower(sup.name)) ILIKE unaccent(${like})
            OR unaccent(lower(coalesce(sup."tradeName", ''))) ILIKE unaccent(${like})
          )
        ORDER BY sup.name ASC
        LIMIT ${take}
      `,
        prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM directory_companies
        WHERE
          unaccent(lower(name)) ILIKE unaccent(${like})
          OR unaccent(lower(coalesce("tradeName", ''))) ILIKE unaccent(${like})
          OR unaccent(lower(coalesce(city, ''))) ILIKE unaccent(${like})
        ORDER BY name ASC
        LIMIT ${take}
      `,
        // `DirectoryStore` é o catálogo global de unidades físicas (as ~14 mil
        // lojas importadas). Estavam INVISÍVEIS na busca até agora — o promotor
        // digitava um nome que existia só no global e recebia "nada encontrado".
        prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM directory_stores
        WHERE
          unaccent(lower(name)) ILIKE unaccent(${like})
          OR unaccent(lower(coalesce(city, ''))) ILIKE unaccent(${like})
        ORDER BY name ASC
        LIMIT ${take}
      `,
      ]);

    const [groups, stores, suppliers, companies, directoryStores] =
      await Promise.all([
        groupIds.length === 0
          ? []
          : prisma.organization.findMany({
              where: { id: { in: groupIds.map((row) => row.id) } },
              orderBy: { name: "asc" },
              select: { slug: true, name: true, logo: true },
            }),
        storeIds.length === 0
          ? []
          : prisma.store.findMany({
              where: { id: { in: storeIds.map((row) => row.id) } },
              orderBy: { name: "asc" },
              select: {
                id: true,
                name: true,
                city: true,
                state: true,
                coverImageKey: true,
                slug: true,
                directoryStoreId: true,
                organization: { select: { slug: true } },
              },
            }),
        supplierIds.length === 0
          ? []
          : prisma.supplier.findMany({
              where: { id: { in: supplierIds.map((row) => row.id) } },
              orderBy: { name: "asc" },
              select: {
                id: true,
                name: true,
                logo: true,
                organization: { select: { slug: true } },
              },
            }),
        companyIds.length === 0
          ? []
          : prisma.directoryCompany.findMany({
              where: { id: { in: companyIds.map((row) => row.id) } },
              orderBy: { name: "asc" },
              select: {
                id: true,
                type: true,
                name: true,
                tradeName: true,
                city: true,
                state: true,
                logoKey: true,
                claimedByOrg: {
                  select: { slug: true, name: true, isPublicProfile: true },
                },
                stores: {
                  where: {
                    OR: [{ city: { not: null } }, { state: { not: null } }],
                  },
                  orderBy: { createdAt: "asc" },
                  take: 3,
                  select: { city: true, state: true },
                },
              },
            }),
        directoryStoreIds.length === 0
          ? []
          : prisma.directoryStore.findMany({
              where: { id: { in: directoryStoreIds.map((row) => row.id) } },
              orderBy: { name: "asc" },
              select: {
                id: true,
                name: true,
                city: true,
                state: true,
                address: true,
                logoKey: true,
                company: {
                  select: {
                    id: true,
                    logoKey: true,
                    claimedByOrg: {
                      select: { slug: true, isPublicProfile: true },
                    },
                  },
                },
                // A Store PÚBLICA linkada, quando existe, dá o caminho bonito
                // (`/tradegram/<slug>`) e evita mostrar o mesmo pino duas vezes
                // — uma como Store, outra como DirectoryStore.
                stores: {
                  where: {
                    isActive: true,
                    organization: { isPublicProfile: true },
                  },
                  orderBy: { createdAt: "asc" },
                  take: 1,
                  select: {
                    id: true,
                    slug: true,
                    organization: { select: { slug: true } },
                  },
                },
              },
            }),
      ]);

    // Ids das Stores já retornadas — servem para tirar da lista de
    // DirectoryStores os que "compartilhariam pino" com uma Store pública já
    // presente na resposta.
    const storeDirectoryIds = new Set(
      stores
        .map((store) => store.directoryStoreId)
        .filter((id): id is string => Boolean(id)),
    );

    // Quem reivindicou e é público já aparece na seção de grupos — sem isto a
    // mesma URL sairia duas vezes na mesma tela.
    const groupSlugs = new Set(groups.map((group) => group.slug));

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
      companies: companies.flatMap((company) => {
        const owner = company.claimedByOrg;
        const ownerIsPublic = Boolean(owner?.isPublicProfile && owner.slug);
        if (ownerIsPublic && owner?.slug && groupSlugs.has(owner.slug)) {
          return [];
        }

        // Distintor visual quando existem homônimos ("SUPERMERCADO COELHO
        // LTDA" 3 vezes). Ordem de força:
        // 1. Cidade cadastrada na empresa (raro no diretório importado).
        // 2. Cidades das unidades — dedup e no máximo 2, para não estourar
        //    a linha ("Fortaleza, Sobral · CE").
        // 3. Só o estado das unidades, se ao menos um veio.
        // 4. null — a UI omite a segunda parte do subtítulo.
        const buildLocation = (): string | null => {
          if (company.city) {
            return company.state
              ? `${company.city} · ${company.state}`
              : company.city;
          }
          const cities = Array.from(
            new Set(
              company.stores
                .map((store) => store.city)
                .filter((city): city is string => Boolean(city)),
            ),
          );
          const states = Array.from(
            new Set(
              company.stores
                .map((store) => store.state)
                .filter((state): state is string => Boolean(state)),
            ),
          );
          if (cities.length > 0) {
            const shown = cities.slice(0, 2).join(", ");
            const extra = cities.length > 2 ? ` +${cities.length - 2}` : "";
            const suffix = states.length === 1 ? ` · ${states[0]}` : "";
            return `${shown}${extra}${suffix}`;
          }
          if (states.length > 0) return states.join(", ");
          return null;
        };

        return [
          {
            type: "company" as const,
            companyId: company.id,
            companyType: company.type,
            name: company.name,
            // `tradeName` só quando ajuda a distinguir do `name` — repetir
            // "SUPERMERCADO COELHO LTDA / Supermercado Coelho" é ruído.
            tradeName:
              company.tradeName &&
              company.tradeName.trim().toLowerCase() !==
                company.name.trim().toLowerCase()
                ? company.tradeName
                : null,
            location: buildLocation(),
            city: company.city,
            state: company.state,
            logoKey: company.logoKey,
            // O caminho é montado NO SERVIDOR: o cliente não conhece a forma
            // da URL, e quando o slug da empresa existir só este trecho muda.
            href:
              ownerIsPublic && owner?.slug
                ? `/tradegram/${owner.slug}`
                : `/tradegram/empresa/${company.id}`,
            // Nome do dono só quando ele é público — senão a busca vira
            // oráculo de quem é cliente da plataforma.
            badge: ownerIsPublic
              ? "Perfil verificado"
              : company.claimedByOrg
                ? "Reivindicada"
                : "Não reivindicada",
          },
        ];
      }),
      // PDVs do catálogo global: linhas que existem no `DirectoryStore` e não
      // são já emitidas via `stores` acima. Cada ponto tenta emprestar o
      // caminho de uma Store pública linkada (URL bonita `/tradegram/<slug>`)
      // — sem isso, o clique quebra em `null`.
      directoryStores: directoryStores.flatMap((point) => {
        if (storeDirectoryIds.has(point.id)) return [];
        const linkedStore = point.stores[0];
        const linkedSlug = linkedStore?.organization?.slug;
        const owner = point.company?.claimedByOrg;
        const ownerIsPublic = Boolean(owner?.isPublicProfile && owner.slug);
        const path = linkedStore?.slug
          ? `/tradegram/${linkedStore.slug}`
          : linkedSlug
            ? `/tradegram/${linkedSlug}/${linkedStore.id}`
            : ownerIsPublic && owner?.slug
              ? `/tradegram/${owner.slug}`
              : point.company?.id
                ? `/tradegram/empresa/${point.company.id}`
                : null;
        const location = point.city
          ? point.state
            ? `${point.city} · ${point.state}`
            : point.city
          : (point.state ?? null);
        return [
          {
            type: "directoryStore" as const,
            id: point.id,
            name: point.name,
            location,
            address: point.address,
            logoKey: point.logoKey ?? point.company?.logoKey ?? null,
            path,
          },
        ];
      }),
    };
  });

// Silencia o import não usado quando alguém mexer no arquivo: o `Prisma`
// namespace fica disponível caso um dia precisemos de `Prisma.sql` para
// composição.
export { Prisma as _PrismaNs };
