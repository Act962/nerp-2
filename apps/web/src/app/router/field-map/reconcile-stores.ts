import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { isSuperAdmin } from "@/lib/super-admin";
import { z } from "zod";
import { resolveDirectoryStore } from "./_resolve-directory-store";

/** Lote por chamada: cada loja custa até duas consultas de casamento. */
const BATCH = 100;

/**
 * Liga ao catálogo nacional as lojas que nasceram antes do elo existir.
 *
 * Idempotente e reversível: **nenhuma carteira é tocada**. Cada organização
 * mantém a sua `Store`, com o nome que deu a ela; o que muda é só o pino no
 * mapa público, que passa a ser um por endereço.
 */
export const reconcileStores = base
  .use(requireAuthMiddleware)
  .input(z.object({}))
  .output(
    z.object({
      linked: z.number(),
      created: z.number(),
      skipped: z.number(),
      remaining: z.number(),
    }),
  )
  .handler(async ({ context, errors }) => {
    if (!isSuperAdmin(context.user.email)) {
      throw errors.FORBIDDEN({
        message: "Só a administração do TradeGram reconcilia o catálogo",
      });
    }

    const pending = await prisma.store.findMany({
      where: {
        directoryStoreId: null,
        latitude: { not: null },
        longitude: { not: null },
      },
      take: BATCH,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        organizationId: true,
        name: true,
        latitude: true,
        longitude: true,
        osmId: true,
        address: true,
        city: true,
        state: true,
      },
    });

    let linked = 0;
    let created = 0;
    let skipped = 0;

    for (const store of pending) {
      const resolved = await resolveDirectoryStore({
        name: store.name,
        latitude: store.latitude,
        longitude: store.longitude,
        osmId: store.osmId,
        address: store.address,
        city: store.city,
        state: store.state,
        // A origem é a importação histórica, não o promotor: o ponto pode ter
        // nascido de qualquer caminho antes do elo existir.
        source: "IMPORTACAO",
        sourceOrgId: store.organizationId,
      });

      if (!resolved) {
        skipped += 1;
        continue;
      }
      await prisma.store.update({
        where: { id: store.id },
        data: { directoryStoreId: resolved.id },
      });
      linked += 1;
      if (resolved.created) created += 1;
    }

    const remaining = await prisma.store.count({
      where: {
        directoryStoreId: null,
        latitude: { not: null },
        longitude: { not: null },
      },
    });

    return { linked, created, skipped, remaining };
  });
