import { listOracleColumns } from "./list-columns";
import { listOracleDimensionValues } from "./list-dimension-values";
import { listOracleTables } from "./list-tables";
import { previewOracleQuery } from "./preview-query";
import {
  deleteOracleQueryTemplate,
  listOracleQueryTemplates,
  saveOracleQueryTemplate,
} from "./templates";

export const oracleExplorerRoutes = {
  listTables: listOracleTables,
  listColumns: listOracleColumns,
  listDimensionValues: listOracleDimensionValues,
  preview: previewOracleQuery,
  templates: {
    list: listOracleQueryTemplates,
    save: saveOracleQueryTemplate,
    delete: deleteOracleQueryTemplate,
  },
};
