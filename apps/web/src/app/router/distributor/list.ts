import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Distribuidores da org, com contagem de indústrias e lojas atendidas.
export const listDistributors = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ search: z.string().optional() }).optional())
  .handler(async ({ input, context }) => {
    const searchTerm = input?.search?.trim();
    const distributors = await prisma.distributor.findMany({
      where: {
        organizationId: context.org.id,
        ...(searchTerm
          ? {
              OR: [
                { name: { contains: searchTerm, mode: "insensitive" } },
                { document: { contains: searchTerm, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        document: true,
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        isActive: true,
        _count: { select: { industries: true, stores: true } },
      },
    });

    return distributors.map((distributor) => ({
      id: distributor.id,
      name: distributor.name,
      document: distributor.document,
      contactName: distributor.contactName,
      contactPhone: distributor.contactPhone,
      contactEmail: distributor.contactEmail,
      isActive: distributor.isActive,
      industryCount: distributor._count.industries,
      storeCount: distributor._count.stores,
    }));
  });
