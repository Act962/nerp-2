import { z } from "zod";
import prisma from "@/lib/db";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { inngest, customerImportRequested } from "@/lib/inngest/client";

/**
 * Inicia uma importação de clientes em massa.
 *
 * O arquivo (CSV/XLSX) já foi enviado ao S3 pelo cliente; aqui apenas
 * registramos a `CustomerImport` (status PENDING) e disparamos o evento Inngest
 * que processa em background. A UI acompanha via `customer.import.get`.
 */
export const createImport = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Iniciar importação de clientes via planilha",
    tags: ["customer"],
  })
  .input(
    z.object({
      fileKey: z.string().min(1),
      fileName: z.string().min(1),
      // { chaveDoCampoDoCliente: nomeDaColunaNoArquivo }
      mapping: z.record(z.string(), z.string()),
    }),
  )
  .output(z.object({ importId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (!input.mapping.name) {
      throw errors.BAD_REQUEST({
        message: "O campo Nome / Razão Social precisa estar mapeado",
      });
    }

    const record = await prisma.customerImport.create({
      data: {
        organizationId: context.org.id,
        createdById: context.user.id,
        fileKey: input.fileKey,
        fileName: input.fileName,
        mapping: input.mapping,
        status: "PENDING",
      },
    });

    await inngest.send(customerImportRequested.create({ importId: record.id }));

    return { importId: record.id };
  });
