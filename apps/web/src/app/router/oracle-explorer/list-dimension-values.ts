import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { loadOracleConfig } from "@/features/erp-sync/server/connectors";
import {
  loadSchemaDictionary,
  resolveColumn,
  resolveTable,
} from "@/features/erp-sync/server/oracle-explorer/dictionary";
import { quickFilterByKey } from "@/features/erp-sync/server/oracle-explorer/quick-filters";
import { withOracleReadOnly } from "@/features/erp-sync/server/oracle-client";
import { requireOrgAdmin } from "../erp-sync/_access";

const MAX_VALUES = 50;
const CACHE_TTL_MS = 60 * 60 * 1000;

interface DimensionValue {
  value: string;
  label: string;
}

// Só o caso sem busca é cacheado (é o que abre o dropdown). Busca digitada vai
// direto ao banco: são tabelas de domínio pequenas e o `FETCH FIRST 50` fecha
// o custo.
const cache = new Map<
  string,
  { expiresAt: number; values: DimensionValue[] }
>();

export const listOracleDimensionValues = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar valores de um filtro rápido (filial, vendedor, cliente…)",
    tags: ["oracle-explorer"],
  })
  .input(
    z.object({
      quickFilter: z.string().min(1),
      search: z.string().max(60).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const definition = quickFilterByKey(input.quickFilter);
    if (!definition) {
      throw errors.NOT_FOUND({ message: "Filtro desconhecido." });
    }

    const search = input.search?.trim() ?? "";
    const cacheKey = `${context.org.id}:${definition.key}`;
    if (!search) {
      const cached = cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return { values: cached.values };
      }
    }

    const dictionary = await loadSchemaDictionary(context.org.id);
    // Nomes vêm do mapa curado, mas são revalidados contra o dicionário: o que
    // entra na SQL é sempre a string canônica do banco.
    const domainTable = resolveTable(dictionary, definition.domain.table);
    const valueColumn = resolveColumn(
      domainTable,
      definition.domain.valueColumn,
    );
    const labelColumn = resolveColumn(
      domainTable,
      definition.domain.labelColumn,
    );

    const config = await loadOracleConfig(context.org.id);
    const where = search
      ? `WHERE UPPER(${labelColumn.name}) LIKE :busca OR TO_CHAR(${valueColumn.name}) LIKE :busca`
      : "";

    const rows = await withOracleReadOnly(
      config,
      (query) =>
        query<{ VALOR: string | number; ROTULO: string | null }>(
          `SELECT ${valueColumn.name} AS "VALOR", ${labelColumn.name} AS "ROTULO"
             FROM ${dictionary.schema}.${domainTable.name}
            ${where}
            ORDER BY ${labelColumn.name}
            FETCH FIRST ${MAX_VALUES} ROWS ONLY`,
          search ? { busca: `%${search.toUpperCase()}%` } : {},
        ),
      { callTimeoutMs: 15_000 },
    );

    const values: DimensionValue[] = rows.map((row) => ({
      value: String(row.VALOR),
      label: row.ROTULO?.trim() || String(row.VALOR),
    }));

    if (!search) {
      cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, values });
    }
    return { values };
  });
