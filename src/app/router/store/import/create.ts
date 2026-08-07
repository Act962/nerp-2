import { z } from "zod";
import prisma from "@/lib/db";
import { isSuperAdmin } from "@/lib/super-admin";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { canManageStores } from "@/app/router/field-map/_can-manage-stores";
import { inngest, storeImportRequested } from "@/lib/inngest/client";

/**
 * Inicia uma importação de lojas em massa.
 *
 * O arquivo (CSV/XLSX) já foi enviado ao S3 pelo cliente; aqui apenas
 * registramos a `StoreImport` (status PENDING) e disparamos o evento Inngest
 * que processa em background. A UI acompanha via `store.import.get`.
 */
export const createImport = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Iniciar importação de lojas via planilha",
    tags: ["store"],
  })
  .input(
    z.object({
      fileKey: z.string().min(1),
      fileName: z.string().min(1),
      // { chaveDoCampoDaLoja: nomeDaColunaNoArquivo }
      mapping: z.record(z.string(), z.string()),
      /**
       * `CATALOGO` grava no catálogo NACIONAL, que não pertence a organização
       * nenhuma — por isso é restrito à administração do TradeGram.
       */
      target: z.enum(["ORGANIZACAO", "CATALOGO"]).default("ORGANIZACAO"),
    }),
  )
  .output(z.object({ importId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (!(await canManageStores(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Você não tem permissão para importar lojas",
      });
    }

    if (input.target === "CATALOGO" && !isSuperAdmin(context.user.email)) {
      throw errors.FORBIDDEN({
        message: "Só a administração do TradeGram alimenta o catálogo nacional",
      });
    }

    if (!input.mapping.name) {
      throw errors.BAD_REQUEST({
        message: "O campo Nome precisa estar mapeado",
      });
    }

    const record = await prisma.storeImport.create({
      data: {
        organizationId: context.org.id,
        createdById: context.user.id,
        fileKey: input.fileKey,
        fileName: input.fileName,
        mapping: input.mapping,
        target: input.target,
        status: "PENDING",
      },
    });

    await inngest.send(storeImportRequested.create({ importId: record.id }));

    return { importId: record.id };
  });
