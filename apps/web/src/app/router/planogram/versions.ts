import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { z } from "zod";

// "Salvar no Histórico": congela a árvore inteira num JSON. Snapshot e não
// tabela relacional porque a versão só é lida INTEIRA (restaurar ou comparar) —
// 500 planogramas × 50 revisões × 300 itens seriam 7,5 milhões de linhas mortas.
// As métricas ficam em colunas próprias para o diff e o dashboard não precisarem
// abrir o JSON.

async function loadTree(planogramId: string) {
  const [fixtures, modules, shelves, items] = await Promise.all([
    prisma.planogramFixture.findMany({
      where: { planogramId },
      orderBy: { order: "asc" },
    }),
    prisma.planogramModule.findMany({
      where: { fixture: { planogramId } },
      orderBy: { index: "asc" },
    }),
    prisma.planogramShelf.findMany({
      where: { module: { fixture: { planogramId } } },
      orderBy: { index: "asc" },
    }),
    prisma.planogramItem.findMany({
      where: { planogramId },
      orderBy: { position: "asc" },
    }),
  ]);
  return { fixtures, modules, shelves, items };
}

export const createPlanogramVersion = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ planogramId: z.string(), label: z.string().optional() }))
  .handler(async ({ input, context, errors }) => {
    const planogram = await prisma.planogram.findFirst({
      where: { id: input.planogramId, organizationId: context.org.id },
      select: { id: true, currentVersion: true },
    });
    if (!planogram) {
      throw errors.NOT_FOUND({ message: "Planograma não encontrado" });
    }

    const tree = await loadTree(planogram.id);
    const facingCount = tree.items.reduce((sum, item) => sum + item.facings, 0);
    const linearMm = tree.items.reduce(
      (sum, item) => sum + item.facings * item.widthMm,
      0,
    );
    const version = planogram.currentVersion;

    const created = await prisma.$transaction(async (tx) => {
      const record = await tx.planogramVersion.create({
        data: {
          organizationId: context.org.id,
          planogramId: planogram.id,
          version,
          label: input.label,
          snapshot: tree as unknown as Prisma.InputJsonValue,
          itemCount: tree.items.length,
          facingCount,
          linearMm,
          createdById: context.user.id,
        },
        select: { id: true, version: true },
      });
      // Incrementa só depois de congelar: a próxima edição já é a versão n+1.
      await tx.planogram.update({
        where: { id: planogram.id },
        data: { currentVersion: version + 1 },
      });
      return record;
    });

    return created;
  });

export const listPlanogramVersions = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ planogramId: z.string() }))
  .handler(async ({ input, context }) => {
    const versions = await prisma.planogramVersion.findMany({
      where: {
        planogramId: input.planogramId,
        organizationId: context.org.id,
      },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        label: true,
        itemCount: true,
        facingCount: true,
        linearMm: true,
        createdAt: true,
        createdBy: { select: { name: true } },
      },
    });

    return {
      versions: versions.map((entry) => ({
        id: entry.id,
        version: entry.version,
        label: entry.label,
        itemCount: entry.itemCount,
        facingCount: entry.facingCount,
        linearMm: entry.linearMm,
        createdAt: entry.createdAt.toISOString(),
        createdByName: entry.createdBy?.name ?? null,
      })),
    };
  });
