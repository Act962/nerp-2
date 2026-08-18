import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { generateTradeCatalogPdf } from "@/features/pdv-catalog/server/generate-catalog-pdf";
import prisma from "@/lib/db";
import { inngest, tradeCatalogGenerateRequested } from "@/lib/inngest/client";
import { z } from "zod";

type GenerateErrors = {
  INTERNAL_SERVER_ERROR: (options: { message: string }) => Error;
};

// Geração síncrona (fallback): renderiza o PDF na própria request. Usada
// quando o Inngest está indisponível. Em falha, marca FAILED pra o catálogo
// nunca ficar preso em GENERATING. Mesmo padrão de book.generate.
async function generateInline(catalogId: string, errors: GenerateErrors) {
  try {
    await generateTradeCatalogPdf(catalogId);
    return { status: "READY" as const };
  } catch (error) {
    await prisma.tradeCatalog
      .update({ where: { id: catalogId }, data: { status: "FAILED" } })
      .catch(() => {});
    console.error(
      `[tradeCatalogDoc.generate] falha na geração inline de ${catalogId}:`,
      error,
    );
    throw errors.INTERNAL_SERVER_ERROR({
      message: "Não foi possível gerar o PDF do catálogo. Tente novamente.",
    });
  }
}

export const generateTradeCatalogDocPdf = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string(), sync: z.boolean().optional() }))
  .handler(async ({ input, context, errors }) => {
    const catalog = await prisma.tradeCatalog.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, _count: { select: { pages: true } } },
    });
    if (!catalog) {
      throw errors.NOT_FOUND({ message: "Catálogo não encontrado" });
    }
    if (catalog._count.pages === 0) {
      throw errors.BAD_REQUEST({
        message: "Gere ao menos uma página antes de exportar o PDF.",
      });
    }

    await prisma.tradeCatalog.update({
      where: { id: input.id },
      data: { status: "GENERATING" },
    });

    if (input.sync) {
      return generateInline(input.id, errors);
    }

    try {
      await inngest.send(
        tradeCatalogGenerateRequested.create({ catalogId: input.id }),
      );
      return { status: "GENERATING" as const };
    } catch (sendError) {
      console.error(
        `[tradeCatalogDoc.generate] inngest.send falhou para ${input.id}, gerando inline:`,
        sendError,
      );
      return generateInline(input.id, errors);
    }
  });
