import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { z } from "zod";
import { capturedAtFilter, dateRangeSchema } from "./_date-range";

// Índice da fila de aprovação: clientes e, dentro de um cliente, indústrias.
// Mesmo desenho do "Minhas fotos" do promotor — só contagem, sem imagem —, mas
// sobre as fotos de TODOS os promotores da org, que é o que a coordenadora vê.
export const listApprovalGroups = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      status: z
        .enum(["ALL", "APPROVED", "REJECTED", "PENDING"])
        .default("PENDING"),
      storeId: z.string().optional(),
      ...dateRangeSchema,
    }),
  )
  .output(
    z.object({
      groups: z.array(
        z.object({
          id: z.string().nullable(),
          name: z.string(),
          total: z.number(),
          pending: z.number(),
          sealMissing: z.number(),
          lastCapturedAt: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true, permissions: true },
    });
    if (!memberCan(member, "books-aprovar")) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para aprovar fotos",
      });
    }

    const where = {
      organizationId: context.org.id,
      promoterName: { not: null },
      ...(input.status === "ALL" ? {} : { approvalStatus: input.status }),
      ...(input.storeId ? { storeId: input.storeId } : {}),
      ...capturedAtFilter(input.from, input.to),
    };

    type Bucket = {
      id: string | null;
      total: number;
      pending: number;
      sealMissing: number;
      lastCapturedAt: Date | null;
    };
    const buckets = new Map<string, Bucket>();

    const accumulate = (
      id: string | null,
      status: string,
      seal: boolean,
      count: number,
      last: Date | null,
    ) => {
      const key = id ?? "";
      const bucket = buckets.get(key) ?? {
        id,
        total: 0,
        pending: 0,
        sealMissing: 0,
        lastCapturedAt: null,
      };
      bucket.total += count;
      if (status === "PENDING") bucket.pending += count;
      if (seal) bucket.sealMissing += count;
      if (last && (!bucket.lastCapturedAt || last > bucket.lastCapturedAt)) {
        bucket.lastCapturedAt = last;
      }
      buckets.set(key, bucket);
    };

    // Ramos explícitos: o `groupBy` tipa o retorno pelo literal do `by`.
    if (input.storeId) {
      const rows = await prisma.pdvPhoto.groupBy({
        by: ["supplierId", "approvalStatus", "sealMissing"],
        where,
        _count: { _all: true },
        _max: { capturedAt: true },
      });
      for (const row of rows) {
        accumulate(
          row.supplierId,
          row.approvalStatus,
          row.sealMissing,
          row._count._all,
          row._max.capturedAt,
        );
      }
    } else {
      const rows = await prisma.pdvPhoto.groupBy({
        by: ["storeId", "approvalStatus", "sealMissing"],
        where,
        _count: { _all: true },
        _max: { capturedAt: true },
      });
      for (const row of rows) {
        accumulate(
          row.storeId,
          row.approvalStatus,
          row.sealMissing,
          row._count._all,
          row._max.capturedAt,
        );
      }
    }

    const ids = [...buckets.values()]
      .map((bucket) => bucket.id)
      .filter((id): id is string => id !== null);

    const names = new Map<string, string>();
    if (ids.length > 0) {
      const records = input.storeId
        ? await prisma.supplier.findMany({
            where: { id: { in: ids }, organizationId: context.org.id },
            select: { id: true, name: true },
          })
        : await prisma.store.findMany({
            where: { id: { in: ids }, organizationId: context.org.id },
            select: { id: true, name: true },
          });
      for (const record of records) names.set(record.id, record.name);
    }

    return {
      groups: [...buckets.values()]
        .map((bucket) => ({
          id: bucket.id,
          name: bucket.id
            ? (names.get(bucket.id) ?? "—")
            : input.storeId
              ? "Sem indústria"
              : "Cliente removido",
          total: bucket.total,
          pending: bucket.pending,
          sealMissing: bucket.sealMissing,
          lastCapturedAt: bucket.lastCapturedAt?.toISOString() ?? null,
        }))
        .sort((a, b) =>
          (b.lastCapturedAt ?? "").localeCompare(a.lastCapturedAt ?? ""),
        ),
    };
  });
