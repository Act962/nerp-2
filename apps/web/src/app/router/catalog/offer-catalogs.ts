import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

/**
 * Os catálogos promocionais que podem ir para o botão "Ofertas".
 *
 * `compartilhado` diz se o link público está ligado: sem ele o visitante
 * cairia num 404, então a tela mostra o catálogo mas não deixa escolher.
 */
export const listOfferCatalogs = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Catálogos promocionais para o botão de ofertas",
    tags: ["settings-catalog"],
  })
  .output(
    z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        compartilhado: z.boolean(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const catalogos = await prisma.promotionalCatalog.findMany({
      where: { organizationId: context.org.id },
      select: { id: true, name: true, config: true },
      orderBy: { updatedAt: "desc" },
    });
    return catalogos.map((catalogo) => {
      const config = (catalogo.config ?? {}) as { shareToken?: unknown };
      return {
        id: catalogo.id,
        name: catalogo.name,
        compartilhado: typeof config.shareToken === "string",
      };
    });
  });
