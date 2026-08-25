import { base } from "@/app/middlewares/base";
import { catalogRowsSchema } from "@/features/pdv-catalog/lib/catalog-types";
import prisma from "@/lib/db";
import { z } from "zod";

// Rota pública: SEM requireAuthMiddleware/requireOrgMiddleware de propósito —
// é o link que o Trade Marketing manda pra fornecedores/indústrias abrirem
// sem login. Resolve pelo shareToken (aleatório, não adivinhável) e só
// devolve algo quando o catálogo estiver marcado isPublic.
export const publicGetTradeCatalog = base
  .input(z.object({ shareToken: z.string() }))
  .handler(async ({ input, errors }) => {
    const catalog = await prisma.tradeCatalog.findUnique({
      where: { shareToken: input.shareToken },
      include: { pages: { orderBy: { order: "asc" } } },
    });

    if (!catalog || !catalog.isPublic) {
      throw errors.NOT_FOUND({ message: "Catálogo não encontrado" });
    }

    return {
      name: catalog.name,
      status: catalog.status,
      pdfKey: catalog.pdfKey,
      showIndex: catalog.showIndex,
      pages: catalog.pages.map((page) => {
        const parsedRows = catalogRowsSchema.safeParse(page.rows);
        return {
          id: page.id,
          title: page.title,
          photoKeys: page.photoKeys,
          rows: parsedRows.success ? parsedRows.data : [],
        };
      }),
    };
  });
