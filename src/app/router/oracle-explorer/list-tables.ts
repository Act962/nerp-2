import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { loadSchemaDictionary } from "@/features/erp-sync/server/oracle-explorer/dictionary";
import { describeTable } from "@/features/erp-sync/server/oracle-explorer/glossary";
import { requireOrgAdmin } from "../erp-sync/_access";

// Tabelas que a credencial do cliente enxerga — nada é chumbado, sai do
// dicionário do próprio banco, então "o que está disponível no acesso" é
// literalmente o que aparece.
export const listOracleTables = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar tabelas legíveis no Oracle do cliente",
    tags: ["oracle-explorer"],
  })
  .input(z.object({}))
  .handler(async ({ context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const dictionary = await loadSchemaDictionary(context.org.id);
    const tables = [...dictionary.tables.values()]
      .map((table) => {
        const term = describeTable(table.name);
        return {
          name: table.name,
          label: term.label,
          description: term.description,
          rowCount: table.rowCount,
        };
      })
      .sort((a, b) => (b.rowCount ?? 0) - (a.rowCount ?? 0));

    return { schema: dictionary.schema, tables };
  });
