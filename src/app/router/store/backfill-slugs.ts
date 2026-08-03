import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { mintStoreSlug } from "@/lib/store-slug";
import { isSuperAdmin } from "@/lib/super-admin";
import { z } from "zod";

/** Lote por chamada: a cunhagem faz duas consultas por loja. */
const BATCH = 200;

/**
 * Preenche o slug das lojas que ainda não têm.
 *
 * Existe porque a migração não faz backfill: slugificar em SQL precisaria da
 * extensão `unaccent`, que pode não estar instalada, e um backfill meio-certo é
 * pior que nenhum. Idempotente — rodar de novo só pega o que faltou.
 */
export const backfillStoreSlugs = base
  .use(requireAuthMiddleware)
  .input(z.object({}))
  .output(z.object({ minted: z.number(), remaining: z.number() }))
  .handler(async ({ context, errors }) => {
    if (!isSuperAdmin(context.user.email)) {
      throw errors.FORBIDDEN({
        message: "Só a administração do TradeGram roda o backfill",
      });
    }

    const pending = await prisma.store.findMany({
      where: { slug: null },
      take: BATCH,
      select: { id: true, name: true, city: true },
    });

    let minted = 0;
    for (const store of pending) {
      const slug = await mintStoreSlug(store.id, store.name, store.city);
      if (slug) minted += 1;
    }

    const remaining = await prisma.store.count({ where: { slug: null } });
    return { minted, remaining };
  });
