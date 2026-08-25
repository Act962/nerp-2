import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Casa nomes de "Cliente" (da aba "Lista") com Lojas (Store) do cadastro, para o
// wizard saber quais já existem e quais são novas. Match por nome (contains,
// insensitive); best-effort — o gestor confere.
export const matchStoresByName = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Casar nomes de clientes com lojas (Store)",
    tags: ["promotional-catalog"],
  })
  .input(z.object({ names: z.array(z.string()).max(500) }))
  .output(
    z.array(
      z.object({
        name: z.string(),
        storeId: z.string().nullable(),
        matchedName: z.string().nullable(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;
    const CHUNK = 8;
    const results: {
      name: string;
      storeId: string | null;
      matchedName: string | null;
    }[] = [];

    for (let i = 0; i < input.names.length; i += CHUNK) {
      const chunk = input.names.slice(i, i + CHUNK);
      const matched = await Promise.all(
        chunk.map(async (name) => {
          const key = name.trim();
          if (key.length < 2) return { name, storeId: null, matchedName: null };
          const s = await prisma.store.findFirst({
            where: {
              organizationId: orgId,
              name: { contains: key, mode: "insensitive" as const },
            },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          });
          return s
            ? { name, storeId: s.id, matchedName: s.name }
            : { name, storeId: null, matchedName: null };
        }),
      );
      results.push(...matched);
    }
    return results;
  });
