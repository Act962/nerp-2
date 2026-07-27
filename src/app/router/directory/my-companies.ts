import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Empresas do diretório já reivindicadas pela org atual.
export const listMyCompanies = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => {
    const companies = await prisma.directoryCompany.findMany({
      where: { claimedByOrgId: context.org.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        type: true,
        name: true,
        document: true,
        city: true,
        state: true,
        claimedAt: true,
      },
    });

    return companies.map((company) => ({
      id: company.id,
      type: company.type,
      name: company.name,
      document: company.document,
      city: company.city,
      state: company.state,
      claimedAt: company.claimedAt?.toISOString() ?? null,
    }));
  });
