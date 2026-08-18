import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { oracleQueryConfigSchema } from "@/features/dashboard-widgets/lib/oracle-query-config";
import { loadSchemaDictionary } from "@/features/erp-sync/server/oracle-explorer/dictionary";
import { preflightOracleQuery } from "@/features/erp-sync/server/oracle-explorer/preflight";
import { runOracleQuery } from "@/features/erp-sync/server/oracle-explorer/run-query";
import { requireOrgAdmin } from "../erp-sync/_access";

// Testa a consulta montada ANTES de virar widget.
//
// Falha esperada (tabela sem permissão, timeout, pré-voo recusado) volta como
// resultado `ok:false`, não como exceção — mesmo padrão de
// erp-sync/test-connection.ts, para um ORA-xxxxx não virar 500 na tela.
export const previewOracleQuery = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Testar uma consulta montada no Oracle",
    tags: ["oracle-explorer"],
  })
  .input(
    z.object({
      config: oracleQueryConfigSchema,
      displayType: z.enum(["STAT", "CHART", "LIST", "TABLE"]),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    try {
      const dictionary = await loadSchemaDictionary(context.org.id);
      const preflight = preflightOracleQuery(dictionary, input.config);
      if (!preflight.ok) {
        return {
          ok: false as const,
          message: preflight.errors.join(" "),
          warnings: preflight.warnings,
          value: null,
          rowCount: 0,
          elapsedMs: 0,
        };
      }

      const result = await runOracleQuery(
        context.org.id,
        input.config,
        input.displayType,
      );
      return {
        ok: true as const,
        message: `${result.rowCount} linha(s) em ${result.elapsedMs} ms.`,
        warnings: preflight.warnings,
        value: result.value,
        rowCount: result.rowCount,
        elapsedMs: result.elapsedMs,
      };
    } catch (error) {
      return {
        ok: false as const,
        message: (error as Error).message.slice(0, 300),
        warnings: [] as string[],
        value: null,
        rowCount: 0,
        elapsedMs: 0,
      };
    }
  });
