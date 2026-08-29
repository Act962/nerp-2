import prisma from "@/lib/db";
import { z } from "zod";
import { p } from "./_shared";

export const listInventoryCounts = p
  .input(
    z
      .object({ status: z.enum(["OPEN", "APPLIED", "CANCELLED"]).optional() })
      .optional(),
  )
  .output(
    z.object({
      counts: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          status: z.enum(["OPEN", "APPLIED", "CANCELLED"]),
          blind: z.boolean(),
          itemCount: z.number(),
          startedAt: z.string(),
          appliedAt: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const rows = await prisma.inventoryCount.findMany({
      where: {
        organizationId: context.org.id,
        ...(input?.status ? { status: input.status } : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        blind: true,
        startedAt: true,
        appliedAt: true,
        _count: { select: { items: true } },
      },
      orderBy: { startedAt: "desc" },
    });

    return {
      counts: rows.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        blind: row.blind,
        itemCount: row._count.items,
        startedAt: row.startedAt.toISOString(),
        appliedAt: row.appliedAt?.toISOString() ?? null,
      })),
    };
  });
