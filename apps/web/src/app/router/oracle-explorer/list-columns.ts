import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  loadSchemaDictionary,
  resolveTable,
} from "@/features/erp-sync/server/oracle-explorer/dictionary";
import { describeColumn } from "@/features/erp-sync/server/oracle-explorer/glossary";
import { quickFiltersFor } from "@/features/erp-sync/server/oracle-explorer/quick-filters";
import { requireOrgAdmin } from "../erp-sync/_access";

// Colunas de uma tabela, já classificadas (medida/dimensão/data) e marcadas
// com informação de índice — é isso que deixa a UI dizer "busca rápida" vs
// "pode ficar lenta" em vez de o usuário descobrir por timeout.
export const listOracleColumns = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar colunas de uma tabela do Oracle do cliente",
    tags: ["oracle-explorer"],
  })
  .input(z.object({ table: z.string().min(1) }))
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const dictionary = await loadSchemaDictionary(context.org.id);
    let table: ReturnType<typeof resolveTable>;
    try {
      table = resolveTable(dictionary, input.table);
    } catch {
      throw errors.NOT_FOUND({ message: "Tabela não encontrada." });
    }

    // `label`/`description` traduzem o nome técnico do Winthor. Sem isso o
    // usuário escolhe entre CODOPER e CONDVENDA no escuro.
    const columns = [...table.columns.values()]
      .map((column) => {
        const term = describeColumn(column.name);
        return {
          name: column.name,
          label: term.label,
          description: term.description,
          dataType: column.dataType,
          role: column.role,
          indexed: column.indexed,
          leadingIndex: column.leadingIndex,
        };
      })
      // Traduzidas primeiro: uma tabela do Winthor tem centenas de colunas
      // (PCMOV tem 173 medidas), quase todas campos fiscais que ninguém usa.
      // Deixar as conhecidas no topo é o que torna a lista navegável.
      .sort((a, b) => {
        const aConhecida = a.label !== a.name;
        const bConhecida = b.label !== b.name;
        if (aConhecida !== bConhecida) return aConhecida ? -1 : 1;
        return a.label.localeCompare(b.label, "pt-BR");
      });

    // Melhor coluna de data para o filtro de período: prioriza a que tem
    // índice como primeira coluna (a única que evita varredura).
    const dateColumns = columns.filter((column) => column.role === "date");
    const suggestedDateColumn =
      dateColumns.find((column) => column.leadingIndex)?.name ??
      dateColumns[0]?.name ??
      null;

    return {
      table: table.name,
      rowCount: table.rowCount,
      columns,
      suggestedDateColumn,
      quickFilters: quickFiltersFor(table.name, (name) =>
        table.columns.has(name),
      ).map((filter) => ({
        key: filter.key,
        label: filter.label,
        column: filter.column,
      })),
      // PCPEDC/PCPEDI carregam a semântica de venda do Winthor.
      supportsSalesFilter:
        table.columns.has("CONDVENDA") && table.columns.has("POSICAO"),
    };
  });
