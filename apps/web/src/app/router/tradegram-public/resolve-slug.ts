import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";

/**
 * Decide o que `/tradegram/<slug>` significa: uma organização ou uma loja.
 *
 * O segmento é um só e os dois namespaces convivem nele. A ORGANIZAÇÃO VENCE:
 * o slug dela é público e compartilhável desde antes, e a cunhagem de slug de
 * loja já evita colidir com ela. Se mesmo assim colidir — uma organização
 * criada depois com o mesmo slug —, a loja continua viva pela URL antiga,
 * enquanto o contrário deixaria um link de organização apontando para uma loja.
 */
export const resolveTradegramSlug = base
  .route({
    method: "GET",
    summary: "Resolve um slug do TradeGram público",
    tags: ["tradegram-public"],
  })
  .input(z.object({ slug: z.string().trim().min(1).max(80) }))
  .output(
    z.object({
      kind: z.enum(["GROUP", "STORE", "NOT_FOUND"]),
      orgSlug: z.string().nullable(),
      storeId: z.string().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const org = await prisma.organization.findUnique({
      where: { slug: input.slug },
      select: { slug: true, isPublicProfile: true },
    });
    if (org?.isPublicProfile && org.slug) {
      return { kind: "GROUP" as const, orgSlug: org.slug, storeId: null };
    }

    const store = await prisma.store.findUnique({
      where: { slug: input.slug },
      select: {
        id: true,
        isActive: true,
        organization: { select: { slug: true, isPublicProfile: true } },
      },
    });
    if (
      store?.isActive &&
      store.organization.isPublicProfile &&
      store.organization.slug
    ) {
      return {
        kind: "STORE" as const,
        orgSlug: store.organization.slug,
        storeId: store.id,
      };
    }

    return { kind: "NOT_FOUND" as const, orgSlug: null, storeId: null };
  });
