import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { generateTradeCatalogPagesFor } from "@/features/pdv-catalog/server/generate-pages";
import prisma from "@/lib/db";
import { z } from "zod";

// A lógica de agrupamento/preço vive em features/pdv-catalog/server para que
// scripts e a aplicação usem o mesmo caminho. Aqui fica só a fronteira:
// autenticação, escopo da org e validação de entrada.
export const generateTradeCatalogPages = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      catalogId: z.string(),
      mediaTypeIds: z.array(z.string()).min(1),
      onlyAvailable: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const catalog = await prisma.tradeCatalog.findFirst({
      where: { id: input.catalogId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!catalog) {
      throw errors.NOT_FOUND({ message: "Catálogo não encontrado" });
    }

    const pageIds = await generateTradeCatalogPagesFor({
      catalogId: input.catalogId,
      organizationId: context.org.id,
      mediaTypeIds: input.mediaTypeIds,
      onlyAvailable: input.onlyAvailable,
    });

    if (pageIds.length === 0) {
      throw errors.BAD_REQUEST({
        message: "Selecione ao menos uma mídia válida",
      });
    }

    return { pageIds };
  });
