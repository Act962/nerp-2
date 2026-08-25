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
      // APP_GALLERY existe só pra alinhar com o tipo compartilhado do promotor;
      // a fila da coordenadora nunca a usa (rascunho não entra aqui).
      status: z
        .enum(["ALL", "APPROVED", "REJECTED", "PENDING", "APP_GALLERY"])
        .default("PENDING"),
      // Dimensão do topo da fila: por loja (com drill loja→indústria), por
      // promotor ou por indústria (nível único → fotos).
      groupBy: z.enum(["store", "promoter", "supplier"]).default("store"),
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
      // Rascunho da Galeria App não aparece pra coordenadora.
      submittedAt: { not: null },
      ...(input.status === "APPROVED" ||
      input.status === "REJECTED" ||
      input.status === "PENDING"
        ? { approvalStatus: input.status }
        : {}),
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

    // Dimensão efetiva: "por loja" com drill vira "supplier"; senão o próprio
    // groupBy. "promoter" agrupa por nome (PdvPhoto só tem promoterName).
    const dimension: "store" | "supplier" | "promoter" =
      input.groupBy === "store"
        ? input.storeId
          ? "supplier"
          : "store"
        : input.groupBy;

    // Ramos explícitos: o `groupBy` do Prisma tipa o retorno pelo literal do `by`.
    if (dimension === "supplier") {
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
    } else if (dimension === "promoter") {
      const rows = await prisma.pdvPhoto.groupBy({
        by: ["promoterName", "approvalStatus", "sealMissing"],
        where,
        _count: { _all: true },
        _max: { capturedAt: true },
      });
      for (const row of rows) {
        accumulate(
          row.promoterName,
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

    // Promotor: o id JÁ é o nome (não há tabela pra resolver). Loja/indústria
    // resolvem o nome pela respectiva tabela.
    const names = new Map<string, string>();
    if (dimension !== "promoter" && ids.length > 0) {
      const records =
        dimension === "supplier"
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

    const emptyLabel =
      dimension === "supplier"
        ? "Sem indústria"
        : dimension === "promoter"
          ? "Sem promotor"
          : "Cliente removido";

    return {
      groups: [...buckets.values()]
        .map((bucket) => ({
          id: bucket.id,
          name: bucket.id
            ? dimension === "promoter"
              ? bucket.id
              : (names.get(bucket.id) ?? "—")
            : emptyLabel,
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
