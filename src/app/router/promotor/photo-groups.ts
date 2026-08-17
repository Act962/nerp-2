import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import { capturedAtFilter, dateRangeSchema } from "./_date-range";

// Índice de "Minhas fotos": primeiro os clientes, depois as indústrias dentro
// de um cliente. Existe para NÃO baixar as fotos: um promotor com 100 clientes
// e meses de histórico traria milhares de linhas e miniaturas só para achar
// uma. Aqui só trafegam nome, contagem e data — as fotos vêm depois, já
// filtradas pelo par cliente+indústria.
export const listMyPhotoGroups = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      status: z
        .enum(["ALL", "APPROVED", "REJECTED", "PENDING", "APP_GALLERY"])
        .default("ALL"),
      // Ausente: agrupa por cliente. Presente: agrupa por indústria dentro dele.
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
          rejected: z.number(),
          lastCapturedAt: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const statusWhere =
      input.status === "ALL"
        ? {}
        : input.status === "APP_GALLERY"
          ? { source: "APP_CAMERA" as const, consumedAt: null }
          : { approvalStatus: input.status };
    const where = {
      organizationId: context.org.id,
      createdById: context.user.id,
      // Rascunhos da Galeria do App não aparecem no índice de "Minhas fotos".
      submittedAt: { not: null },
      ...statusWhere,
      ...(input.storeId ? { storeId: input.storeId } : {}),
      ...capturedAtFilter(input.from, input.to),
    };

    type Bucket = {
      id: string | null;
      total: number;
      pending: number;
      rejected: number;
      lastCapturedAt: Date | null;
    };
    const buckets = new Map<string, Bucket>();

    const accumulate = (
      id: string | null,
      status: string,
      count: number,
      last: Date | null,
    ) => {
      const key = id ?? "";
      const bucket = buckets.get(key) ?? {
        id,
        total: 0,
        pending: 0,
        rejected: 0,
        lastCapturedAt: null,
      };
      bucket.total += count;
      if (status === "PENDING") bucket.pending += count;
      if (status === "REJECTED") bucket.rejected += count;
      if (last && (!bucket.lastCapturedAt || last > bucket.lastCapturedAt)) {
        bucket.lastCapturedAt = last;
      }
      buckets.set(key, bucket);
    };

    // Dois ramos explícitos em vez de um `by` dinâmico: o `groupBy` do Prisma
    // tipa o retorno a partir do literal do `by`, e uma variável apagaria isso.
    if (input.storeId) {
      const rows = await prisma.pdvPhoto.groupBy({
        by: ["supplierId", "approvalStatus"],
        where,
        _count: { _all: true },
        _max: { capturedAt: true },
      });
      for (const row of rows) {
        accumulate(
          row.supplierId,
          row.approvalStatus,
          row._count._all,
          row._max.capturedAt,
        );
      }
    } else {
      const rows = await prisma.pdvPhoto.groupBy({
        by: ["storeId", "approvalStatus"],
        where,
        _count: { _all: true },
        _max: { capturedAt: true },
      });
      for (const row of rows) {
        accumulate(
          row.storeId,
          row.approvalStatus,
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
          rejected: bucket.rejected,
          lastCapturedAt: bucket.lastCapturedAt?.toISOString() ?? null,
        }))
        // Mais recente primeiro: o promotor procura o que fez hoje, não o que
        // começa com "A".
        .sort((a, b) =>
          (b.lastCapturedAt ?? "").localeCompare(a.lastCapturedAt ?? ""),
        ),
    };
  });
