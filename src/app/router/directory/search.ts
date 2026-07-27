import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Diretório global de empresas: navega/busca as cascas pré-cadastradas. Mostra
// o status de reivindicação e se pertence à org atual. Cross-org por natureza —
// a base é compartilhada.
export const searchDirectory = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      q: z.string().trim().optional(),
      type: z.enum(["SUPERMERCADO", "INDUSTRIA", "DISTRIBUIDOR"]).optional(),
      claimed: z.enum(["all", "claimed", "unclaimed"]).default("all"),
      limit: z.number().int().min(1).max(100).default(50),
    }),
  )
  .handler(async ({ input, context }) => {
    const term = input.q;
    const companies = await prisma.directoryCompany.findMany({
      where: {
        type: input.type,
        ...(input.claimed === "claimed"
          ? { claimedByOrgId: { not: null } }
          : input.claimed === "unclaimed"
            ? { claimedByOrgId: null }
            : {}),
        ...(term
          ? {
              OR: [
                { name: { contains: term, mode: "insensitive" } },
                { tradeName: { contains: term, mode: "insensitive" } },
                { document: { contains: term, mode: "insensitive" } },
                { city: { contains: term, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: input.limit,
      select: {
        id: true,
        type: true,
        name: true,
        tradeName: true,
        document: true,
        city: true,
        state: true,
        logoKey: true,
        claimedByOrgId: true,
        claimedByOrg: { select: { name: true } },
      },
    });

    return companies.map((company) => ({
      id: company.id,
      type: company.type,
      name: company.name,
      tradeName: company.tradeName,
      document: company.document,
      city: company.city,
      state: company.state,
      logoKey: company.logoKey,
      isClaimed: company.claimedByOrgId !== null,
      isMine: company.claimedByOrgId === context.org.id,
      claimedByName: company.claimedByOrg?.name ?? null,
    }));
  });
