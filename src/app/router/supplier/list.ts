import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { PersonType, type Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import z from "zod";

const DEFAULT_PAGE_SIZE = 10;

export const listSupplier = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      personType: z.enum(PersonType).optional(),
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
    }),
  )
  .output(
    z.object({
      suppliers: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          tradeName: z.string().nullable(),
          document: z.string().nullable(),
          personType: z.enum(PersonType),
          phone: z.string().nullable(),
          email: z.string().nullable(),
          contactPerson: z.string().nullable(),
          city: z.string().nullable(),
          state: z.string().nullable(),
          isActive: z.boolean(),
          logo: z.string().nullable(),
          actionCodeImage: z.string().nullable(),
        }),
      ),
      totalCount: z.number(),
      page: z.number(),
      pageSize: z.number(),
      totalPages: z.number(),
    }),
  )
  .handler(async ({ context, input }) => {
    const { page, pageSize } = input;
    const search = input.search?.trim();

    const where: Prisma.SupplierWhereInput = {
      organizationId: context.org.id,
      ...(input.personType && { personType: input.personType }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { tradeName: { contains: search, mode: "insensitive" } },
          { document: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [suppliers, totalCount] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          tradeName: true,
          document: true,
          personType: true,
          phone: true,
          email: true,
          contactPerson: true,
          city: true,
          state: true,
          isActive: true,
          logo: true,
          actionCodeImage: true,
        },
      }),
      prisma.supplier.count({ where }),
    ]);

    return {
      suppliers,
      totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    };
  });
