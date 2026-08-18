import { z } from "zod";
import prisma from "@/lib/db";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

/**
 * Retorna o status/progresso de uma importação para o polling da UI.
 * Escopado pela organização do contexto.
 */
export const getImport = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Status de uma importação de fornecedores",
    tags: ["supplier"],
  })
  .input(z.object({ importId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const record = await prisma.supplierImport.findFirst({
      where: { id: input.importId, organizationId: context.org.id },
    });

    if (!record) {
      throw errors.NOT_FOUND({ message: "Importação não encontrada" });
    }

    return {
      id: record.id,
      fileName: record.fileName,
      status: record.status,
      totalRows: record.totalRows,
      processedRows: record.processedRows,
      createdRows: record.createdRows,
      skippedRows: record.skippedRows,
      failedRows: record.failedRows,
      errors: record.errors as { row: number; message: string }[],
      createdAt: record.createdAt,
      completedAt: record.completedAt,
    };
  });
