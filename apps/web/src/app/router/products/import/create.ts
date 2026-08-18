import { z } from "zod";
import prisma from "@/lib/db";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { inngest, productImportRequested } from "@/lib/inngest/client";

/**
 * Inicia uma importação de produtos em massa.
 *
 * O arquivo (CSV/XLSX) já foi enviado ao S3 pelo cliente; aqui apenas
 * registramos a `ProductImport` (status PENDING) e disparamos o evento Inngest
 * que processa em background. A UI acompanha via `products.import.get`.
 */
export const createImport = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Iniciar importação de produtos via planilha",
    tags: ["products"],
  })
  .input(
    z.object({
      fileKey: z.string().min(1),
      fileName: z.string().min(1),
      // { chaveDoCampoDoProduto: nomeDaColunaNoArquivo }
      mapping: z.record(z.string(), z.string()),
    }),
  )
  .output(z.object({ importId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (!input.mapping.name) {
      throw errors.BAD_REQUEST({
        message: "O campo Nome precisa estar mapeado",
      });
    }

    const record = await prisma.productImport.create({
      data: {
        organizationId: context.org.id,
        createdById: context.user.id,
        fileKey: input.fileKey,
        fileName: input.fileName,
        mapping: input.mapping,
        status: "PENDING",
      },
    });

    await inngest.send(productImportRequested.create({ importId: record.id }));

    return { importId: record.id };
  });
